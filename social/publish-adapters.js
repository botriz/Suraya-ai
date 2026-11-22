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

export async function publishSocialPost({platform,tokenCiphertext,post}) {
  if(platform!=="telegram") throw new Error("No verified publishing adapter is available for this platform.");
  const token=decryptSocialToken(tokenCiphertext);
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
