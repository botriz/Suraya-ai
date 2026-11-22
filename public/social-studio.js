(()=>{
 const $=id=>document.getElementById(id);
 document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id==="panel-"+btn.dataset.tab));
  if(btn.dataset.tab==="management"&&operatorToken) refreshManagement();
  if(btn.dataset.tab==="calendar"&&operatorToken) loadCalendar();
 }));
 const PLATFORMS=["instagram","youtube","telegram","rubika","facebook","x","tiktok","snapchat","whatsapp","eitaa"];
 const PLATFORM_LABELS={instagram:"Instagram",youtube:"YouTube",telegram:"Telegram",rubika:"Rubika",facebook:"Facebook",x:"X",tiktok:"TikTok",snapchat:"Snapchat",whatsapp:"WhatsApp",eitaa:"Eitaa"};
 const PLATFORM_GLYPHS={instagram:"◎",youtube:"▶",telegram:"➤",rubika:"ر",facebook:"f",x:"𝕏",tiktok:"♪",snapchat:"👻",whatsapp:"◉",eitaa:"e"};
 let operatorToken="",latestDraft=null;
 function setStatus(id,message,error=false){const el=$(id);if(!el)return;el.textContent=message;el.classList.toggle("error",error)}
 async function authFetch(url,options={}){
  if(!operatorToken)throw new Error("ابتدا با توکن مدیر وارد شو.");
  const headers={Accept:"application/json",...(options.headers||{}),Authorization:"Bearer "+operatorToken};
  if(options.body)headers["Content-Type"]="application/json";
  const response=await fetch(url,{...options,headers,cache:"no-store"});
  const data=await response.json().catch(()=>({ok:false,error:"پاسخ سرور قابل خواندن نیست."}));
  if(response.status===401){operatorToken="";throw new Error("دسترسی مدیر معتبر نیست؛ دوباره وارد شو.")}
  if(!response.ok||!data.ok)throw new Error(data.error||"درخواست انجام نشد.");
  return data;
 }
 function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node}
 function renderDraft(draft){
  latestDraft=draft;const host=$("draftOutput");host.className="result";host.replaceChildren();
  [["عنوان",draft.title],["کپشن",draft.caption],["هشتگ‌ها",draft.hashtags],["سناریو",draft.script],["دعوت به اقدام",draft.cta]].forEach(([label,value])=>{
   const wrap=el("div");wrap.style.marginBottom="12px";wrap.append(el("h3",label),el("pre",value));host.append(wrap);
  });
  const actions=el("div",undefined,"result-actions");
  const copy=el("button","کپی بستهٔ محتوا","btn secondary");copy.addEventListener("click",()=>navigator.clipboard?.writeText(Object.entries(draft).map(([k,v])=>k+": "+v).join("\n\n")));
  const schedule=el("button","افزودن عنوان به تقویم","btn secondary");schedule.addEventListener("click",()=>{$("planTitle").value=draft.title;document.querySelector('[data-tab="calendar"]').click();$("planDate").focus()});
  const save=el("button","ذخیرهٔ پیش‌نویس در سرور","btn");save.disabled=!operatorToken;save.title=operatorToken?"":"ابتدا در بخش مدیریت وارد شو";
  save.addEventListener("click",async()=>{save.disabled=true;try{const r=await authFetch("/api/social/v1/posts",{method:"POST",body:JSON.stringify({platform:$("platform").value,title:draft.title,caption:draft.caption,hashtags:draft.hashtags,script:draft.script,mediaType:$("mediaType").value,mediaUrl:$("mediaUrl").value.trim()})});setStatus("draftStatus","پیش‌نویس با شناسهٔ "+r.post.public_id+" در PostgreSQL ذخیره شد.");await loadPosts()}catch(e){setStatus("draftStatus",e.message,true)}finally{save.disabled=!operatorToken}});
  actions.append(copy,schedule,save);host.append(actions);
 }
 $("draftForm").addEventListener("submit",async e=>{
  e.preventDefault();const btn=$("generateBtn");btn.disabled=true;setStatus("draftStatus","در حال درخواست از موتور تولید محتوا…");
  try{
   const response=await fetch("/api/creator/v1/draft",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({topic:$("topic").value.trim(),audience:$("audience").value.trim(),objective:$("objective").value,brandVoice:$("brandVoice").value.trim(),platform:$("platform").value,tone:$("tone").value,language:$("language").value})});
   const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"تولید پیش‌نویس انجام نشد.");
   renderDraft(data.draft);setStatus("draftStatus","پیش‌نویس آماده شد؛ پیش از استفاده آن را بررسی کن.");
  }catch(err){setStatus("draftStatus",err.message||"ارتباط با سرویس برقرار نشد.",true)}finally{btn.disabled=false}
 });
 async function loadCalendar(){
  const host=$("planList");if(!operatorToken){host.replaceChildren(el("div","برای مشاهدهٔ تقویم سرور، ابتدا ورود مدیر را انجام بده.","empty"));return}
  try{
   const data=await authFetch("/api/social/v1/calendar");host.replaceChildren();
   if(!data.items.length){host.append(el("div","هنوز موردی در تقویم سرور ثبت نشده است.","empty"));return}
   data.items.forEach(item=>{
    const row=el("div",undefined,"entry"),left=el("span"),title=el("b",item.title),meta=el("small",PLATFORM_LABELS[item.platform]||item.platform+" · "+new Date(item.scheduled_for).toLocaleString());
    meta.textContent=(PLATFORM_LABELS[item.platform]||item.platform)+" · "+new Date(item.scheduled_for).toLocaleString("fa-IR");
    left.append(title,meta);const del=el("button","حذف","btn secondary");
    del.addEventListener("click",async()=>{del.disabled=true;try{await authFetch("/api/social/v1/calendar/"+item.id,{method:"DELETE"});await loadCalendar()}catch(e){setStatus("planStatus",e.message,true);del.disabled=false}});
    row.append(left,del);host.append(row);
   });
  }catch(e){host.replaceChildren(el("div",e.message,"empty"))}
 }
 $("planForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!operatorToken){setStatus("planStatus","برای ذخیرهٔ تقویم در سرور، ابتدا ورود مدیر را انجام بده.",true);return}
  const date=$("planDate").value;if(!date){setStatus("planStatus","تاریخ را وارد کن.",true);return}
  const item={title:$("planTitle").value.trim(),platform:$("planPlatform").value.toLowerCase(),scheduledFor:new Date(date+"T12:00:00").toISOString(),notes:$("planNotes").value.trim()};
  try{await authFetch("/api/social/v1/calendar",{method:"POST",body:JSON.stringify(item)});e.currentTarget.reset();setStatus("planStatus","در تقویم PostgreSQL ذخیره شد؛ هنوز هیچ انتشار خودکاری زمان‌بندی نشده است.");await loadCalendar()}
  catch(err){setStatus("planStatus",err.message,true)}
 });
 async function loadPlans(){
  const host=$("planCatalog");try{const d=await authFetch("/api/social/v1/plans");host.replaceChildren();
   d.plans.forEach(p=>{const row=el("div",undefined,"entry"),left=el("span"),name=el("b",p.name+" · "+p.code),limits=el("small","حساب: "+p.limits.connected_accounts+" · پیش‌نویس ماهانه: "+p.limits.ai_drafts_per_month+" · ویدئو: "+p.limits.video_minutes_per_month+" دقیقه");left.append(name,limits);row.append(left,el("b",p.monthly_price+" "+p.currency+"/ماه"));host.append(row)});
   host.append(el("small","تعرفه‌ها تعریف شده‌اند؛ پرداخت، فعال‌سازی و اعمال محدودیت اشتراک تا اتصال درگاه و حساب مشتری غیرفعال است."));
  }catch(e){host.replaceChildren(el("div",e.message,"empty"))}
 }
 async function loadAccounts(){
  const host=$("connectedAccounts");try{const d=await authFetch("/api/social/v1/accounts");host.replaceChildren();
   PLATFORMS.forEach(p=>{const found=d.accounts.filter(a=>a.platform===p),row=el("div",undefined,"entry"),left=el("span"),name=el("b",PLATFORM_LABELS[p]),status=el("small",found.length?found.map(a=>a.account_label+" · "+a.connection_status).join(" | "):"متصل نشده");left.append(name,status);if(found.length){found.forEach(account=>{const disconnect=el("button","قطع اتصال","btn warning");disconnect.addEventListener("click",async()=>{disconnect.disabled=true;try{const result=await authFetch("/api/social/v1/accounts/"+account.id+"/disconnect",{method:"POST",body:"{}"});setStatus("operatorStatus",result.notice);await loadAccounts()}catch(e){setStatus("operatorStatus",e.message,true);disconnect.disabled=false}});row.append(disconnect)})}else{const connect=el("button","اتصال رسمی","btn secondary");connect.addEventListener("click",async()=>{connect.disabled=true;try{const result=await authFetch("/api/social/v1/accounts/"+p+"/connect",{method:"POST",body:"{}"});if(result.authorizationUrl){window.location.assign(result.authorizationUrl);return}await loadAccounts();setStatus("operatorStatus",PLATFORM_LABELS[p]+" با موفقیت بررسی و متصل شد.")}catch(e){setStatus("operatorStatus",PLATFORM_LABELS[p]+": "+e.message,true)}finally{connect.disabled=false}});row.append(connect)}host.append(row)});
  }catch(e){host.replaceChildren(el("div",e.message,"empty"))}
 }
 async function loadPosts(){
  const host=$("managedPosts");try{const d=await authFetch("/api/social/v1/posts");host.replaceChildren();
   if(!d.posts.length){host.append(el("div","هنوز پیش‌نویسی در سرور ثبت نشده است.","empty"));return}
   d.posts.forEach(p=>{const row=el("div",undefined,"entry"),left=el("span"),title=el("b",p.title),meta=el("small",(PLATFORM_LABELS[p.platform]||p.platform)+" · "+p.status+" · "+p.public_id);left.append(title,meta);row.append(left);
    if(["draft","in_review"].includes(p.status)){const approve=el("button","تأیید محتوا","btn secondary");approve.addEventListener("click",async()=>{approve.disabled=true;try{await authFetch("/api/social/v1/posts/"+p.public_id+"/approve",{method:"POST",body:"{}"});await loadPosts()}catch(e){setStatus("operatorStatus",e.message,true);approve.disabled=false}});row.append(approve)}
    if(p.status==="approved"){const when=el("input");when.type="datetime-local";when.setAttribute("aria-label","زمان انتشار");when.style.maxWidth="180px";const schedule=el("button","زمان‌بندی","btn secondary");schedule.addEventListener("click",async()=>{if(!when.value){setStatus("operatorStatus","زمان انتشار را انتخاب کن.",true);return}schedule.disabled=true;try{await authFetch("/api/social/v1/posts/"+p.public_id+"/schedule",{method:"POST",body:JSON.stringify({scheduledAt:new Date(when.value).toISOString()})});await loadPosts()}catch(e){setStatus("operatorStatus",e.message,true);schedule.disabled=false}});row.append(when,schedule)}
    host.append(row);
   });
  }catch(e){host.replaceChildren(el("div",e.message,"empty"))}
 }
 async function loadSegments(){
  const host=$("segmentList");try{const d=await authFetch("/api/social/v1/segments");host.replaceChildren();
   if(!d.segments.length){host.append(el("div","هنوز بخشی تعریف نشده است.","empty"));return}
   d.segments.forEach(s=>{const row=el("div",undefined,"entry");row.append(el("span",s.name+" · "+s.status));host.append(row)});
  }catch(e){host.replaceChildren(el("div",e.message,"empty"))}
 }
 async function refreshManagement(){await Promise.all([loadPlans(),loadAccounts(),loadPosts(),loadSegments()])}
 $("operatorForm").addEventListener("submit",async e=>{
  e.preventDefault();operatorToken=$("operatorToken").value.trim();setStatus("operatorStatus","در حال بررسی مجوز…");
  try{const d=await authFetch("/api/social/v1/overview");setStatus("operatorStatus","دسترسی تأیید شد؛ "+d.platforms.length+" شبکه در فهرست مدیریت قرار دارد.");$("operatorToken").value="";await refreshManagement();await loadCalendar()}
  catch(err){operatorToken="";setStatus("operatorStatus",err.message,true)}
 });
 $("operatorLogout").addEventListener("click",()=>{operatorToken="";$("operatorToken").value="";["planCatalog","connectedAccounts","managedPosts","segmentList"].forEach(id=>$(id).replaceChildren(el("div","برای مشاهده، ورود مدیر لازم است.","empty")));setStatus("operatorStatus","از پنل خارج شدی و توکن از حافظهٔ صفحه پاک شد.")});
 $("segmentForm").addEventListener("submit",async e=>{
  e.preventDefault();try{let criteria;try{criteria=JSON.parse($("segmentCriteria").value)}catch{throw new Error("معیارها باید JSON معتبر باشند.")}
   await authFetch("/api/social/v1/segments",{method:"POST",body:JSON.stringify({name:$("segmentName").value.trim(),description:$("segmentDescription").value.trim(),criteria})});
   e.currentTarget.reset();$("segmentCriteria").value='{"language":"fa","interest":"education"}';setStatus("segmentStatus","تعریف بخش مخاطبان ذخیره شد؛ دادهٔ واقعی مخاطبان هنوز متصل نیست.");await loadSegments();
  }catch(err){setStatus("segmentStatus",err.message,true)}
 });
 async function refreshHealth(){
  $("healthDetails").replaceChildren(el("div","در حال دریافت وضعیت…","empty"));
  try{
   const [statusRes,capRes]=await Promise.all([fetch("/api/status",{cache:"no-store"}),fetch("/api/capabilities",{cache:"no-store"})]);
   const status=await statusRes.json(),caps=(await capRes.json()).capabilities||{};
   $("apiState").textContent=status.status==="ready"?"آماده":"محدود";$("apiDetail").textContent=status.service+" · "+status.version;
   $("aiState").textContent=caps.contentGeneration?"آماده":"پیکربندی‌نشده";$("aiDetail").textContent=caps.contentGeneration?"قابلیت اعلام‌شده از سرور":"نیازمند پیکربندی امن مدیر";
   $("draftState").textContent=caps.contentGeneration?"آماده":"پیکربندی‌نشده";
   const labels={orderIntake:"ثبت سفارش",contentGeneration:"تولید محتوا",operatorDesk:"میز عملیات",digitalWorldReadApi:"API جهان دیجیتال",socialWorkspace:"مدیریت اجتماعی پایدار",persistentSocialCalendar:"تقویم PostgreSQL",socialAudienceInsights:"تحلیل واقعی مخاطبان",payments:"پرداخت آنلاین",socialOAuth:"اتصال OAuth شبکه‌ها",telegramPublishing:"انتشار زمان‌بندی‌شده تلگرام",cryptoWallet:"کیف پول رمزارزی",personalWallet:"کیف پول شخصی",persistentUserAccounts:"حساب کاربری پایدار",automaticPublishing:"انتشار خودکار",liveAssistant:"دستیار اجرای زنده"};
   $("healthDetails").replaceChildren();
   Object.entries(labels).forEach(([key,label])=>{const row=el("div",undefined,"entry");row.append(el("b",label),el("small",caps[key]?"فعال":"غیرفعال"));$("healthDetails").append(row)});
  }catch{$("apiState").textContent="نامشخص";$("apiDetail").textContent="عدم دریافت وضعیت";$("aiState").textContent="نامشخص";$("aiDetail").textContent="خطای ارتباط";$("healthDetails").replaceChildren(el("div","خواندن وضعیت سرور ممکن نشد؛ بعداً دوباره تلاش کن.","empty"))}
 }
 $("refreshHealth").addEventListener("click",refreshHealth);
 refreshHealth();
})();
