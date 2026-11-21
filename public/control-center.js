(()=>{
 const $=id=>document.getElementById(id);
 const labels={
  orderIntake:["ثبت سفارش","دریافت و ثبت سفارش‌ها در PostgreSQL"],
  contentGeneration:["تولید محتوا","تولید پیش‌نویس از طریق ارائه‌دهندهٔ هوش مصنوعی"],
  operatorDesk:["میز عملیات","دسترسی اپراتور برای پیگیری سفارش‌ها"],
  digitalWorldReadApi:["API جهان دیجیتال","خواندن داده‌های پایدار جهان"],
  payments:["پرداخت آنلاین","درگاه پرداخت و تأیید تراکنش"],
  socialOAuth:["اتصال حساب‌های اجتماعی","مجوز رسمی و محدود پلتفرم‌ها"],
  cryptoWallet:["کیف پول رمزارزی","عملیات کیف پول و اتصال بلاکچین"],
  personalWallet:["کیف پول شخصی","حساب و تراکنش‌های کیف پول کاربر"],
  persistentUserAccounts:["حساب‌های کاربری پایدار","احراز هویت و حساب سمت سرور"],
  automaticPublishing:["انتشار خودکار","صف انتشار و اتصال رسمی شبکه‌ها"]
 };
 const on=val=>Boolean(val);
 function stateTag(active){const span=document.createElement("span");span.className="state "+(active?"on":"off");span.textContent=active?"فعال":"غیرفعال";return span}
 function moduleRow(name,desc,active){const row=document.createElement("div");row.className="module";const copy=document.createElement("span"),b=document.createElement("b"),small=document.createElement("small");b.textContent=name;small.textContent=desc;copy.append(b,small);row.append(copy,stateTag(active));return row}
 function diag(title,detail,kind="off"){const row=document.createElement("div");row.className="diag";const b=document.createElement("strong"),p=document.createElement("span");b.textContent=title;p.textContent=detail;row.append(b,p);row.style.borderColor=kind==="on"?"#82e8d044":kind==="bad"?"#ffaaaa55":"#d6b56b33";return row}
 function renderCapabilities(caps,status){
  const host=$("modules");host.replaceChildren();
  Object.entries(labels).forEach(([key,[name,desc]])=>host.append(moduleRow(name,desc,on(caps[key]))));
  $("db").textContent=caps.orderIntake?"آماده":"غیرفعال";
  $("ai").textContent=caps.contentGeneration?"آماده":"پیکربندی‌نشده";
  const notes=[];
  if(!caps.orderIntake)notes.push(["ثبت سفارش در دسترس نیست","اتصال DATABASE_URL و آماده‌بودن PostgreSQL را در محیط میزبانی بررسی کن."]);
  if(!caps.contentGeneration)notes.push(["موتور تولید محتوا پیکربندی نشده","AI_API_KEY و تنظیمات ارائه‌دهنده را فقط در محیط امن Render بررسی کن؛ کلید را در مرورگر یا چت قرار نده."]);
  if(!caps.operatorDesk)notes.push(["میز اپراتور فعال نیست","آماده‌بودن پایگاه داده و SURAYA_OPERATOR_TOKEN را بررسی کن."]);
  if(!caps.socialOAuth)notes.push(["حساب‌های اجتماعی متصل نیستند","برای هر پلتفرم، OAuth رسمی، دامنهٔ مجاز، توکن رمزنگاری‌شده و امکان لغو دسترسی لازم است."]);
  if(!caps.automaticPublishing)notes.push(["انتشار خودکار غیرفعال است","ابتدا مجوزهای رسمی، صف پردازش، idempotency، تأیید مالک و ثبت ممیزی را تکمیل کن."]);
  if(!caps.payments)notes.push(["پرداخت آنلاین فعال نیست","درگاه و وب‌هوک امضاشده، کنترل تکرار، بازپرداخت و تطبیق مالی لازم است."]);
  if(!caps.cryptoWallet&&!caps.personalWallet)notes.push(["کیف پول عملیاتی فعال نیست","تا تکمیل طراحی امنیتی و کنترل کلید، هیچ موجودی یا انتقالی را شبیه‌سازی نکن."]);
  const hostDiag=$("diagnostics");hostDiag.replaceChildren();
  if(status.status==="ready")hostDiag.append(diag("سلامت API اصلی","سرور وضعیت آماده گزارش کرده است.","on"));
  else notes.unshift(["سلامت API اصلی محدود است","جزئیات وضعیت را در گزارش سرویس و لاگ‌های میزبانی بررسی کن."]);
  if(!notes.length)hostDiag.append(diag("مانع شناخته‌شده‌ای گزارش نشده","این نتیجه فقط بر اساس قابلیت‌های اعلام‌شدهٔ API است؛ جایگزین آزمون امنیتی یا مرور لاگ نیست.","on"));
  notes.forEach(([a,b])=>hostDiag.append(diag(a,b)));
 }
 async function refresh(){
  $("overall").textContent="در حال بررسی…";$("refresh").disabled=true;
  try{
   const [statusResponse,capResponse,serviceResponse]=await Promise.all([
    fetch("/api/status",{cache:"no-store"}),fetch("/api/capabilities",{cache:"no-store"}),fetch("/api/services",{cache:"no-store"})
   ]);
   if(!statusResponse.ok)throw new Error("API status HTTP "+statusResponse.status);
   if(!capResponse.ok)throw new Error("API capabilities HTTP "+capResponse.status);
   if(!serviceResponse.ok)throw new Error("Service catalogue HTTP "+serviceResponse.status);
   const status=await statusResponse.json(),capData=await capResponse.json(),serviceData=await serviceResponse.json();
   const caps=capData.capabilities||status.capabilities||{};
   $("overall").textContent=status.status==="ready"?"آماده":"محدود";
   $("uptime").textContent=status.service+" · نسخه "+status.version+" · uptime "+Math.floor(status.uptime||0)+"s";
   $("updated").textContent="آخرین بررسی: "+new Date().toLocaleString("fa-IR");
   renderCapabilities(caps,status);
   const services=serviceData.services||{},host=$("services");host.replaceChildren();
   Object.entries(services).forEach(([code,item])=>{
    const card=document.createElement("article");card.className="service";
    const title=document.createElement("b"),desc=document.createElement("p");
    title.textContent=item.title||code;desc.textContent=(item.description||"خدمت ثبت‌شده در کاتالوگ.")+" · "+(item.billing==="monthly"?"ماهانه":"یک‌باره");
    card.append(title,desc);
    if(code==="social_monthly"||code==="social_content"){const link=document.createElement("a");link.className="link";link.href="/social-studio.html";link.textContent="ورود به مدیریت شبکه‌ها";link.style.display="inline-block";link.style.marginTop="9px";card.append(link)}
    host.append(card);
   });
   if(!Object.keys(services).length)host.append(diag("کاتالوگ خالی است","API فهرست خدمات خدمتی برای نمایش گزارش نکرد."));
  }catch(error){
   $("overall").textContent="نامشخص";$("uptime").textContent=error.message;$("db").textContent="نامشخص";$("ai").textContent="نامشخص";$("updated").textContent="دریافت وضعیت ناموفق بود";
   $("diagnostics").replaceChildren(diag("عدم دریافت وضعیت زنده",error.message,"bad"));
  }finally{$("refresh").disabled=false}
 }
 $("refresh").addEventListener("click",refresh);refresh();
})();