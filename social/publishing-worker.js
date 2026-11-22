import { publishSocialPost } from "./publish-adapters.js";

export function startSocialPublishingWorker({pool,intervalMs=5000,onError=error=>console.error("Social publishing worker:",error.message)}={}) {
  if(!pool)return {stop(){}};
  let busy=false,stopped=false,recovering=true;
  async function claimOne(){
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const selected=await client.query(
        "SELECT j.id AS job_id,j.attempts,j.max_attempts,p.id AS post_id,p.public_id,p.platform,p.title,p.caption,p.hashtags,p.script,p.media_url,p.media_type,p.account_id,a.token_ciphertext FROM suraya_social_jobs j JOIN suraya_social_posts p ON p.id=j.post_id JOIN suraya_social_accounts a ON a.id=p.account_id WHERE j.status='queued' AND j.run_after<=NOW() AND p.status='scheduled' AND a.connection_status='connected' ORDER BY j.run_after,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1");
      if(!selected.rowCount){await client.query("COMMIT");return null}
      const job=selected.rows[0];
      await client.query("UPDATE suraya_social_jobs SET status='running',attempts=attempts+1,updated_at=NOW() WHERE id=$1",[job.job_id]);
      await client.query("COMMIT");
      return job;
    }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}
    finally{client.release()}
  }
  async function finish(job,result){
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      await client.query("UPDATE suraya_social_posts SET status='published',external_post_id=$2,published_at=$3,updated_at=NOW() WHERE id=$1 AND status='scheduled'",[job.post_id,result.externalPostId,result.publishedAt]);
      await client.query("UPDATE suraya_social_jobs SET status='succeeded',last_error=NULL,updated_at=NOW() WHERE id=$1",[job.job_id]);
      await client.query("INSERT INTO suraya_social_audit_events(actor,action,resource_type,resource_id,outcome,details) VALUES('system:social-worker','post.published','social_post',$1,'success',$2::jsonb)",[job.public_id,JSON.stringify({platform:job.platform,externalPostId:result.externalPostId})]);
      await client.query("COMMIT");
    }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}
    finally{client.release()}
  }
  async function fail(job,error){
    const safeMessage=String(error?.message||"Provider rejected the publish request").slice(0,500);
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      await client.query("UPDATE suraya_social_posts SET status='failed',failure_code='PUBLISH_FAILED',failure_message=$2,updated_at=NOW() WHERE id=$1 AND status='scheduled'",[job.post_id,safeMessage]);
      await client.query("UPDATE suraya_social_jobs SET status='failed',last_error=$2,updated_at=NOW() WHERE id=$1",[job.job_id,safeMessage]);
      await client.query("INSERT INTO suraya_social_audit_events(actor,action,resource_type,resource_id,outcome,details) VALUES('system:social-worker','post.publish_failed','social_post',$1,'failed',$2::jsonb)",[job.public_id,JSON.stringify({platform:job.platform,error:safeMessage,manualReviewRequired:true})]);
      await client.query("COMMIT");
    }catch(dbError){await client.query("ROLLBACK").catch(()=>{});throw dbError}
    finally{client.release()}
  }
  async function tick(){
    if(busy||stopped||recovering)return;
    busy=true;
    try{
      const job=await claimOne();
      if(!job)return;
      try{
        const result=await publishSocialPost({platform:job.platform,tokenCiphertext:job.token_ciphertext,post:job});
        await finish(job,result);
      }catch(error){await fail(job,error)}
    }catch(error){onError(error)}
    finally{busy=false}
  }
  const timer=setInterval(tick,intervalMs);
  timer.unref?.();
  void pool.query("UPDATE suraya_social_jobs SET status='failed',last_error='Worker restarted during execution; verify the provider result manually before retrying.',updated_at=NOW() WHERE status='running'")
    .then(()=>pool.query("UPDATE suraya_social_posts SET status='failed',failure_code='PUBLISH_RESULT_UNCERTAIN',failure_message='Worker restarted during execution; provider result requires manual verification.',updated_at=NOW() WHERE id IN (SELECT post_id FROM suraya_social_jobs WHERE status='failed' AND last_error LIKE 'Worker restarted during execution%') AND status='scheduled'"))
    .catch(onError).finally(()=>{recovering=false;void tick()});
  return {stop(){stopped=true;clearInterval(timer)}};
}
