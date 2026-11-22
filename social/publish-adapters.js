const META_VERSION=process.env.SOCIAL_META_API_VERSION||"v22.0";
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


async function tiktokCall(path,token,body) {
  const response=await fetch("https://open.tiktokapis.com"+path,{method:"POST",headers:{Authorization:"Bearer "+token.access_token,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error&&data.error.code!=="ok")throw new Error("TikTok publishing request failed.");
  return data.data||{};
}
async function publishTikTok(token,post) {
  if(!post.media_url||post.media_type!=="video")throw new Error("TikTok publishing requires a public video URL.");
  const requiredHost=process.env.SOCIAL_TIKTOK_MEDIA_DOMAIN||"";
  let mediaHost="";try{mediaHost=new URL(post.media_url).hostname}catch{}
  if(!requiredHost||mediaHost!==requiredHost)throw new Error("TikTok PULL_FROM_URL requires a verified media domain configured by the owner.");
  const creator=await tiktokCall("/v2/post/publish/creator_info/query/",token,{});
  const options=creator.creator_info?.privacy_level_options||[];
  const privacy=options.includes("PUBLIC_TO_EVERYONE")?"PUBLIC_TO_EVERYONE":options[0];
  if(!privacy)throw new Error("TikTok creator privacy options are unavailable.");
  const text=[post.caption,post.hashtags].filter(Boolean).join("\n\n").trim().slice(0,2200);
  const init=await tiktokCall("/v2/post/publish/video/init/",token,{
    post_info:{title:(text||post.title).slice(0,150),privacy_level:privacy,disable_comment:false,disable_duet:false,disable_stitch:false,video_cover_timestamp_ms:1000},
    source_info:{source:"PULL_FROM_URL",video_url:post.media_url}
  });
  if(!init.publish_id)throw new Error("TikTok did not return a publish job identifier.");
  let status="PROCESSING_DOWNLOAD";
  for(let attempt=0;attempt<36;attempt++){
    await new Promise(resolve=>setTimeout(resolve,5000));
    const check=await tiktokCall("/v2/post/publish/status/fetch/",token,{publish_id:init.publish_id});
    status=check.status||status;
    if(status==="PUBLISH_COMPLETE")return {externalPostId:String(init.publish_id),publishedAt:new Date().toISOString()};
    if(["FAILED","PUBLISH_FAILED"].includes(status))throw new Error("TikTok rejected or failed to publish the video.");
  }
  throw new Error("TikTok publish job is still processing; verify its status in TikTok before retrying.");
}

async function refreshGoogleToken(token) {
  if(!token.refresh_token)return token.access_token;
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.SOCIAL_YOUTUBE_CLIENT_ID||"",client_secret:process.env.SOCIAL_YOUTUBE_CLIENT_SECRET||"",refresh_token:token.refresh_token,grant_type:"refresh_token"}),signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.access_token)throw new Error("Google access token refresh failed.");
  return data.access_token;
}
async function publishYouTube(token,accountMetadata,post) {
  if(!post.media_url||post.media_type!=="video")throw new Error("YouTube publishing requires a video media URL.");
  const mediaUrl=new URL(post.media_url);
  const allowed=(process.env.SURAYA_MEDIA_ALLOWED_HOSTS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(mediaUrl.protocol!=="https:"||!allowed.includes(mediaUrl.hostname.toLowerCase()))throw new Error("YouTube media URL host is not in SURAYA_MEDIA_ALLOWED_HOSTS.");
  const media=await fetch(mediaUrl,{redirect:"error",signal:AbortSignal.timeout(60000)});
  if(!media.ok||!media.body)throw new Error("Video source could not be retrieved from the approved media host.");
  const size=Number(media.headers.get("content-length")||0),contentType=media.headers.get("content-type")||"video/mp4";
  if(!size||size>1024*1024*1024||!contentType.startsWith("video/"))throw new Error("Video file size or media type is not supported.");
  const accessToken=await refreshGoogleToken(token);
  const title=String(post.title||"Suraya video").slice(0,100);
  const description=[post.caption,post.hashtags].filter(Boolean).join("\n\n").slice(0,5000);
  const metadata={snippet:{title,description,categoryId:"22"},status:{privacyStatus:"public",selfDeclaredMadeForKids:false}};
  const init=await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",{
    method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":contentType,"X-Upload-Content-Length":String(size)},
    body:JSON.stringify(metadata),signal:AbortSignal.timeout(30000)
  });
  if(!init.ok||!init.headers.get("location"))throw new Error("YouTube did not create a resumable upload session.");
  const uploaded=await fetch(init.headers.get("location"),{method:"PUT",headers:{"Content-Type":contentType,"Content-Length":String(size)},body:media.body,duplex:"half",signal:AbortSignal.timeout(15*60*1000)});
  const result=await uploaded.json().catch(()=>({}));
  if(!uploaded.ok||!result.id)throw new Error("YouTube video upload failed.");
  if(accountMetadata.channelId&&result.snippet?.channelId&&result.snippet.channelId!==accountMetadata.channelId)throw new Error("Uploaded video channel does not match the connected channel.");
  return {externalPostId:String(result.id),publishedAt:new Date().toISOString()};
}

async function publishX(token,post) {
  if(post.media_url)throw new Error("X text publishing is enabled; media upload is not yet supported.");
  const text=[post.caption,post.hashtags].filter(Boolean).join("\n\n").trim()||post.title;
  if(text.length>280)throw new Error("X text exceeds the 280-character limit for this adapter.");
  const response=await fetch("https://api.x.com/2/tweets",{method:"POST",headers:{Authorization:"Bearer "+token.access_token,"Content-Type":"application/json"},body:JSON.stringify({text}),signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.data?.id)throw new Error("X post creation failed.");
  return {externalPostId:String(data.data.id),publishedAt:new Date().toISOString()};
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
