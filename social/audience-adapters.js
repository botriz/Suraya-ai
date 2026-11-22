const META_VERSION=process.env.SOCIAL_META_API_VERSION||"v22.0";
async function readJson(url,token) {
  const response=await fetch(url,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error("Provider analytics request failed ("+response.status+").");
  return data;
}
function dateRange(days=28){
  const end=new Date(),start=new Date(end.getTime()-days*86400000);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
export async function fetchVerifiedAudienceSnapshot(account,token) {
  const accessToken=token.access_token||token.botToken;
  if(!accessToken)throw new Error("No access token is available for this account.");
  let metrics={},source;
  if(account.platform==="instagram"||account.platform==="facebook"){
    const fields=account.platform==="instagram"?"followers_count,media_count,username":"followers_count,fan_count";
    const url="https://graph.facebook.com/"+META_VERSION+"/"+encodeURIComponent(account.external_account_id)+"?fields="+encodeURIComponent(fields)+"&access_token="+encodeURIComponent(accessToken);
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.error)throw new Error("Meta insights request failed.");
    metrics={followers:data.followers_count??data.fan_count??null,publishedMedia:data.media_count??null,username:data.username??null};
    source="meta_graph_api";
  }else if(account.platform==="youtube"){
    const {start,end}=dateRange(28),channelId=account.external_account_id;
    const url="https://youtubeanalytics.googleapis.com/v2/reports?"+new URLSearchParams({ids:"channel=="+channelId,startDate:start,endDate:end,metrics:"views,likes,comments,subscribersGained",dimensions:"day",sort:"day"});
    const report=await readJson(url,accessToken);
    metrics={periodDays:28,headers:(report.columnHeaders||[]).map(x=>x.name),dailyRows:report.rows||[]};
    try{
      const demographicUrl="https://youtubeanalytics.googleapis.com/v2/reports?"+new URLSearchParams({ids:"channel=="+channelId,startDate:start,endDate:end,metrics:"viewerPercentage",dimensions:"ageGroup,gender"});
      const demographics=await readJson(demographicUrl,accessToken);
      metrics.demographics={headers:(demographics.columnHeaders||[]).map(x=>x.name),rows:demographics.rows||[]};
    }catch{metrics.demographicsUnavailable=true}
    source="youtube_analytics_api";
  }else if(account.platform==="tiktok"){
    const url="https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,following_count,likes_count,video_count";
    const data=await readJson(url,accessToken);
    const user=data.data?.user;if(!user)throw new Error("TikTok audience profile was not returned.");
    metrics={followers:user.follower_count??null,following:user.following_count??null,totalLikes:user.likes_count??null,videoCount:user.video_count??null,displayName:user.display_name??null};
    source="tiktok_user_info_api";
  }else if(account.platform==="x"){
    const url="https://api.x.com/2/users/"+encodeURIComponent(account.external_account_id)+"?user.fields=public_metrics";
    const data=await readJson(url,accessToken);
    metrics=data.data?.public_metrics||{};
    source="x_api_public_metrics";
  }else{
    throw new Error("Verified audience analytics are not available for this platform.");
  }
  return {source,verified:true,capturedAt:new Date().toISOString(),metrics};
}
