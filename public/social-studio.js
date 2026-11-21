(()=>{
 const $=id=>document.getElementById(id);
 document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id==="panel-"+btn.dataset.tab));
 }));
 const supported=new Set(["instagram","youtube","rubika","telegram","linkedin"]);
 let latestDraft=null;
 function setStatus(id,message,error=false){const el=$(id);el.textContent=message;el.classList.toggle("error",error)}
 function renderDraft(draft){
  latestDraft=draft;
  const host=$("draftOutput");host.className="result";host.replaceChildren();
  [["عنوان",draft.title],["کپشن",draft.caption],["هشتگ‌ها",draft.hashtags],["سناریو",draft.script],["دعوت به اقدام",draft.cta]].forEach(([label,value])=>{
   const wrap=document.createElement("div");wrap.style.marginBottom="12px";const h=document.createElement("h3");h.textContent=label;const pre=document.createElement("pre");pre.textContent=value;wrap.append(h,pre);host.append(wrap);
  });
  const actions=document.createElement("div");actions.className="result-actions";
  const copy=document.createElement("button");copy.className="btn secondary";copy.textContent="کپی بستهٔ محتوا";copy.addEventListener("click",()=>navigator.clipboard.writeText(Object.entries(draft).map(([k,v])=>k+": "+v).join("\n\n")));
  const schedule=document.createElement("button");schedule.className="btn";schedule.textContent="افزودن عنوان به تقویم";schedule.addEventListener("click",()=>{ $("planTitle").value=draft.title;document.querySelector('[data-tab="calendar"]').click();$("planDate").focus();});
  actions.append(copy,schedule);host.append(actions);
 }
 $("draftForm").addEventListener("submit",async e=>{
  e.preventDefault();const btn=$("generateBtn");btn.disabled=true;setStatus("draftStatus","در حال درخواست از موتور تولید محتوا…");
  try{
   const response=await fetch("/api/creator/v1/draft",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({topic:$("topic").value.trim(),platform:$("platform").value,tone:$("tone").value,language:$("language").value})});
   const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"تولید پیش‌نویس انجام نشد.");
   renderDraft(data.draft);setStatus("draftStatus","پیش‌نویس آماده شد؛ پیش از استفاده آن را بررسی کن.");
  }catch(err){setStatus("draftStatus",err.message||"ارتباط با سرویس برقرار نشد.",true)}
  finally{btn.disabled=false}
 });
 const KEY="suraya_social_editorial_v1";
 function plans(){try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
 function savePlans(items){localStorage.setItem(KEY,JSON.stringify(items))}
 function renderPlans(){
  const host=$("planList"),items=plans().sort((a,b)=>a.date.localeCompare(b.date));host.replaceChildren();
  if(!items.length){host.innerHTML='<div class="empty">هنوز موردی ثبت نشده است.</div>';return}
  items.forEach(item=>{
   const row=document.createElement("div");row.className="entry";const copy=document.createElement("span"),title=document.createElement("b"),meta=document.createElement("small");
   title.textContent=item.title;meta.textContent=item.platform+" · "+item.date;copy.append(title,meta);
   const del=document.createElement("button");del.className="btn secondary";del.textContent="حذف";del.addEventListener("click",()=>{savePlans(plans().filter(x=>x.id!==item.id));renderPlans()});row.append(copy,del);host.append(row);
  });
 }
 $("planForm").addEventListener("submit",e=>{
  e.preventDefault();const item={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:$("planTitle").value.trim(),platform:$("planPlatform").value,date:$("planDate").value,notes:$("planNotes").value.trim()};
  const items=plans();items.push(item);savePlans(items);e.currentTarget.reset();renderPlans();setStatus("planStatus","در برنامهٔ محلی همین مرورگر ثبت شد؛ هیچ پستی زمان‌بندی یا منتشر نشد.");
 });
 async function refreshHealth(){
  $("healthDetails").innerHTML='<div class="empty">در حال دریافت وضعیت…</div>';
  try{
   const [statusRes,capRes]=await Promise.all([fetch("/api/status",{cache:"no-store"}),fetch("/api/capabilities",{cache:"no-store"})]);
   const status=await statusRes.json(),caps=(await capRes.json()).capabilities||{};
   $("apiState").textContent=status.status==="ready"?"آماده":"محدود";$("apiDetail").textContent=status.service+" · "+status.version;
   $("aiState").textContent=caps.contentGeneration?"آماده":"پیکربندی‌نشده";$("aiDetail").textContent=caps.contentGeneration?"قابلیت اعلام‌شده از سرور":"نیازمند پیکربندی امن مدیر";
   $("draftState").textContent=caps.contentGeneration?"آماده":"پیکربندی‌نشده";
   const labels={orderIntake:"ثبت سفارش",contentGeneration:"تولید محتوا",operatorDesk:"میز عملیات",digitalWorldReadApi:"API جهان دیجیتال",payments:"پرداخت آنلاین",socialOAuth:"اتصال OAuth شبکه‌ها",cryptoWallet:"کیف پول رمزارزی",personalWallet:"کیف پول شخصی",persistentUserAccounts:"حساب کاربری پایدار",automaticPublishing:"انتشار خودکار"};
   $("healthDetails").replaceChildren();
   Object.entries(labels).forEach(([key,label])=>{const row=document.createElement("div");row.className="entry";const name=document.createElement("b");name.textContent=label;const val=document.createElement("small");val.textContent=caps[key]?"فعال":"غیرفعال";row.append(name,val);$("healthDetails").append(row)});
  }catch(err){$("apiState").textContent="نامشخص";$("apiDetail").textContent="عدم دریافت وضعیت";$("aiState").textContent="نامشخص";$("aiDetail").textContent="خطای ارتباط";$("healthDetails").innerHTML='<div class="empty">خواندن وضعیت سرور ممکن نشد؛ بعداً دوباره تلاش کن.</div>'}
 }
 $("refreshHealth").addEventListener("click",refreshHealth);
 renderPlans();refreshHealth();
})();
