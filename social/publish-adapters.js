import { decryptSocialToken } from "./token-crypto.js";

async function telegramCall(botToken,method,body) {
  const response=await fetch("https://api.telegram.org/bot"+botToken+"/"+method,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok) throw new Error("Telegram "+method+" failed ("+(data.error_code||response.status)+").");
  return data.result;
}

export async function verifyTelegramDestination(botToken,chatId) {
  const me=await telegramCall(botToken,"getMe",{});
  const chat=await telegramCall(botToken,"getChat",{chat_id:chatId});
  const member=await telegramCall(botToken,"getChatMember",{chat_id:chat.id,user_id:me.id});
  if(["channel","supergroup"].includes(chat.type)&&!["administrator","creator"].includes(member.status)) {
    throw new Error("The Telegram bot must be an administrator of the destination channel.");
  }
  if(["group","supergroup"].includes(chat.type)&&["left","kicked"].includes(member.status)) {
    throw new Error("The Telegram bot is not a member of the destination group.");
  }
  return {bot:me,chat,member};
}


async function metaRequest(path,token,params={},method="POST") {
  const url=new URL("https://graph.facebook.com/"+META_VERSION+"/"+path);
  const body=new URLSearchParams({...params,access_token:token});
  const response=await fetch(method==="GET"?url.toString()+"?"+body.toString():url.toString(),{
    method,headers:method==="GET"?{}:{"Content-Type":"application/x-www-form-urlencoded"},
    body:method==="GET"?undefined:body.toString(),signal:AbortSignal.timeout(30000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error)throw new Error("Meta publishing request failed ("+(data.error?.code||response.status)+").");
  return data;
}
async function publishMetaPost(platform,token,accountMetadata,post) {
  const caption=[post.caption,post.hashtags].filter(Boolean).join("\n\n").trim()||post.title;
  if(platform==="facebook"){
    const pageId=accountMetadata.pageId;
    if(!pageId)throw new Error("Facebook Page metadata is missing.");
    let path,params;
    if(post.media_type==="video"&&post.media_url){path=pageId+"/videos";params={file_url:post.media_url,description:caption};}
    else if(post.media_type==="image"&&post.media_url){path=pageId+"/photos";params={url:post.media_url,caption};}
    else {path=pageId+"/feed";params={message:caption};}
    const result=await metaRequest(path,token.access_token,params);
    return {externalPostId:String(result.id||result.post_id),publishedAt:new Date().toISOString()};
  }
  const instagramId=accountMetadata.instagramId;
  if(!instagramId)throw new Error("Instagram professional account metadata is missing.");
  if(!post.media_url||!["image","video"].includes(post.media_type))throw new Error("Instagram publishing requires a public HTTPS image or video URL.");
  const params={caption};
  if(post.media_type==="video"){params.media_type="REELS";params.video_url=post.media_url;}
  else params.image_url=post.media_url;
  const container=await metaRequest(instagramId+"/media",token.access_token,params);
  if(!container.id)throw new Error("Meta did not return an Instagram media container.");
  let state="IN_PROGRESS";
  for(let attempt=0;attempt<20;attempt++){
    const status=await metaRequest(container.id,token.access_token,{fields:"status_code"},"GET");
    state=status.status_code||state;
    if(state==="FINISHED")break;
    if(state==="ERROR"||state==="EXPIRED")throw new Error("Instagram media processing failed.");
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  if(state!=="FINISHED")throw new Error("Instagram media processing timed out; verify the container before retrying.");
  const published=await metaRequest(instagramId+"/media_publish",token.access_token,{creation_id:container.id});
  if(!published.id)throw new Error("Meta did not confirm the Instagram publish result.");
  return {externalPostId:String(published.id),publishedAt:new Date().toISOString()};
}

export async function publishSocialPost({platform,tokenCiphertext,post,accountMetadata={}}) {
  const token=decryptSocialToken(tokenCiphertext);
  if(platform==="instagram"||platform==="facebook")return publishMetaPost(platform,token,accountMetadata,post);
  if(platform!=="telegram") throw new Error("No verified publishing adapter is available for this platform.");
  const text=[post.caption,post.hashtags].filter(Boolean).join("\n\n").trim()||post.title;
  let result;
  if(post.media_url&&post.media_type==="video") {
    if(text.length<=1024) result=await telegramCall(token.botToken,"sendVideo",{chat_id:token.chatId,video:post.media_url,caption:text});
    else {result=await telegramCall(token.botToken,"sendVideo",{chat_id:token.chatId,video:post.media_url});await telegramCall(token.botToken,"sendMessage",{chat_id:token.chatId,text});}
  } else if(post.media_url&&post.media_type==="image") {
    if(text.length<=1024) result=await telegramCall(token.botToken,"sendPhoto",{chat_id:token.chatId,photo:post.media_url,caption:text});
    else {result=await telegramCall(token.botToken,"sendPhoto",{chat_id:token.chatId,photo:post.media_url});await telegramCall(token.botToken,"sendMessage",{chat_id:token.chatId,text});}
  } else {
    result=await telegramCall(token.botToken,"sendMessage",{chat_id:token.chatId,text:text.length?text:post.title});
  }
  return {externalPostId:String(result.message_id),publishedAt:new Date().toISOString()};
}
