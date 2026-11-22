const META_VERSION=process.env.SOCIAL_META_API_VERSION||"v22.0";
const AUTH_TIMEOUT=15000;
const configFor={
  instagram:()=>({kind:"meta",id:process.env.SOCIAL_META_CLIENT_ID,secret:process.env.SOCIAL_META_CLIENT_SECRET}),
  facebook:()=>({kind:"meta",id:process.env.SOCIAL_META_CLIENT_ID,secret:process.env.SOCIAL_META_CLIENT_SECRET}),
  youtube:()=>({kind:"google",id:process.env.SOCIAL_YOUTUBE_CLIENT_ID,secret:process.env.SOCIAL_YOUTUBE_CLIENT_SECRET}),
  tiktok:()=>({kind:"tiktok",id:process.env.SOCIAL_TIKTOK_CLIENT_KEY,secret:process.env.SOCIAL_TIKTOK_CLIENT_SECRET}),
  x:()=>({kind:"x",id:process.env.SOCIAL_X_CLIENT_ID,secret:process.env.SOCIAL_X_CLIENT_SECRET})
};

export function oauthConfigured(platform,env=process.env) {
  const getter=configFor[platform];if(!getter||!env.SURAYA_PUBLIC_BASE_URL||!env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY)return false;
  const c=getter();return Boolean(c.id&&c.secret);
}
export function socialRedirectUri(platform,env=process.env) {
  const base=String(env.SURAYA_PUBLIC_BASE_URL||"").replace(/\/+$/,"");
  if(!/^https:\/\//i.test(base)) throw new Error("SURAYA_PUBLIC_BASE_URL must be an HTTPS origin.");
  return base+"/api/social/v1/oauth/"+platform+"/callback";
}
export function createAuthorizationUrl(platform,{state,codeVerifier,env=process.env}) {
  const c=configFor[platform]?.();if(!c?.id||!c.secret)throw new Error("OAuth client credentials are not configured.");
  const redirectUri=socialRedirectUri(platform,env),url=new URL(
    c.kind==="meta"?"https://www.facebook.com/"+META_VERSION+"/dialog/oauth":
    c.kind==="google"?"https://accounts.google.com/o/oauth2/v2/auth":
    c.kind==="tiktok"?"https://www.tiktok.com/v2/auth/authorize/":
    "https://twitter.com/i/oauth2/authorize"
  );
  if(c.kind==="meta"){
    url.searchParams.set("client_id",c.id);url.searchParams.set("redirect_uri",redirectUri);url.searchParams.set("response_type","code");url.searchParams.set("state",state);
    url.searchParams.set("scope","pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,instagram_manage_insights");
  }else if(c.kind==="google"){
    url.searchParams.set("client_id",c.id);url.searchParams.set("redirect_uri",redirectUri);url.searchParams.set("response_type","code");url.searchParams.set("state",state);
    url.searchParams.set("scope","openid email profile https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly");
    url.searchParams.set("access_type","offline");url.searchParams.set("prompt","consent");
  }else if(c.kind==="tiktok"){
    url.searchParams.set("client_key",c.id);url.searchParams.set("redirect_uri",redirectUri);url.searchParams.set("response_type","code");url.searchParams.set("state",state);url.searchParams.set("scope","user.info.basic,video.upload,video.publish");
  }else{
    url.searchParams.set("client_id",c.id);url.searchParams.set("redirect_uri",redirectUri);url.searchParams.set("response_type","code");url.searchParams.set("state",state);
    url.searchParams.set("scope","tweet.read tweet.write users.read offline.access");
    const challenge=Buffer.from(awaitlessHash(codeVerifier)).toString("base64url");
    url.searchParams.set("code_challenge",challenge);url.searchParams.set("code_challenge_method","S256");
  }
  return url.toString();
}
function awaitlessHash(value){return requireHash(value)}
import { createHash as requireHash } from "node:crypto";

async function fetchJson(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(AUTH_TIMEOUT)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error("OAuth provider request failed ("+response.status+").");
  return data;
}
function form(values){return new URLSearchParams(Object.entries(values).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>[k,String(v)])).toString()}
export async function exchangeAndIdentify(platform,{code,codeVerifier,env=process.env}) {
  const c=configFor[platform]?.();if(!c)throw new Error("Unsupported OAuth provider.");
  const redirectUri=socialRedirectUri(platform,env);let token;
  if(c.kind==="meta"){
    token=await fetchJson("https://graph.facebook.com/"+META_VERSION+"/oauth/access_token?"+form({client_id:c.id,client_secret:c.secret,redirect_uri:redirectUri,code}));
    const me=await fetchJson("https://graph.facebook.com/"+META_VERSION+"/me?"+form({fields:"id,name",access_token:token.access_token}));
    const pages=await fetchJson("https://graph.facebook.com/"+META_VERSION+"/me/accounts?"+form({fields:"id,name,access_token,instagram_business_account{id,username}",access_token:token.access_token}));
    const accounts=[];
    for(const page of pages.data||[]){
      if(platform==="facebook")accounts.push({platform:"facebook",externalId:page.id,label:page.name||"Facebook Page",token:{...token,access_token:page.access_token||token.access_token},metadata:{pageId:page.id}});
      if(platform==="instagram"&&page.instagram_business_account)accounts.push({platform:"instagram",externalId:page.instagram_business_account.id,label:page.instagram_business_account.username||"Instagram Business",token:{...token,access_token:page.access_token||token.access_token},metadata:{pageId:page.id,instagramId:page.instagram_business_account.id}});
    }
    if(!accounts.length)throw new Error(platform==="instagram"?"No Instagram professional account was found on an authorized Facebook Page.":"No Facebook Page was granted to this application.");
    return {accounts,scopes:(token.scope||"").split(",").filter(Boolean),expiresAt:token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000):null,providerUser:{id:me.id,name:me.name}};
  }
  if(c.kind==="google"){
    token=await fetchJson("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form({code,client_id:c.id,client_secret:c.secret,redirect_uri:redirectUri,grant_type:"authorization_code"})});
    const channels=await fetchJson("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",{headers:{Authorization:"Bearer "+token.access_token}});
    const channel=channels.items?.[0];if(!channel)throw new Error("No YouTube channel is available for the authorized Google account.");
    return {accounts:[{platform:"youtube",externalId:channel.id,label:channel.snippet?.title||"YouTube channel",token,metadata:{channelId:channel.id}}],scopes:(token.scope||"").split(" ").filter(Boolean),expiresAt:token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000):null};
  }
  if(c.kind==="tiktok"){
    token=await fetchJson("https://open.tiktokapis.com/v2/oauth/token/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form({client_key:c.id,client_secret:c.secret,code,grant_type:"authorization_code",redirect_uri:redirectUri})});
    const profile=await fetchJson("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name",{headers:{Authorization:"Bearer "+token.access_token}});
    const user=profile.data?.user;if(!user?.open_id)throw new Error("TikTok profile could not be verified.");
    return {accounts:[{platform:"tiktok",externalId:user.open_id,label:user.display_name||"TikTok account",token,metadata:{unionId:user.union_id||null,avatarUrl:user.avatar_url||null}}],scopes:(token.scope||"").split(",").filter(Boolean),expiresAt:token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000):null};
  }
  token=await fetchJson("https://api.x.com/2/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Authorization:"Basic "+Buffer.from(c.id+":"+c.secret).toString("base64")},body:form({code,grant_type:"authorization_code",client_id:c.id,redirect_uri:redirectUri,code_verifier:codeVerifier})});
  const profile=await fetchJson("https://api.x.com/2/users/me?user.fields=name,username",{headers:{Authorization:"Bearer "+token.access_token}});
  const user=profile.data;if(!user?.id)throw new Error("X profile could not be verified.");
  return {accounts:[{platform:"x",externalId:user.id,label:user.name||user.username||"X account",token,metadata:{username:user.username||null}}],scopes:(token.scope||"").split(" ").filter(Boolean),expiresAt:token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000):null};
}
