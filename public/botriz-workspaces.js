/* Botriz page modes, grouped service navigation and custom wallpaper. */
(function(){
 const body=document.body,nav=document.querySelector(".wrap>.nav");
 if(!nav||document.getElementById("surayaAppearanceTools"))return;
 const wall=document.createElement("div");wall.className="suraya-wallpaper-layer";wall.setAttribute("aria-hidden","true");body.prepend(wall);
 const tools=document.createElement("div");tools.className="suraya-appearance-tools";tools.id="surayaAppearanceTools";
 tools.innerHTML='<div class="suraya-mode-switch" role="group" aria-label="حالت نمایش"><button type="button" data-mode="simple" aria-pressed="true">ساده</button><button type="button" data-mode="professional" aria-pressed="false">حرفه‌ای</button></div><button type="button" class="suraya-wallpaper-button" id="surayaWallpaperOpen">تصویر زمینه</button><input type="file" id="surayaWallpaperFile" accept="image/*" hidden><button type="button" class="suraya-wallpaper-button" id="surayaWallpaperReset" hidden>حذف تصویر</button>';
 const navLinks=nav.querySelector(".nav-links");(navLinks||nav).after(tools);
 const safeRead=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
 const safeWrite=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{return false}};
 const modeKey="botriz_ui_mode_v1",wallKey="botriz_wallpaper_v1";
 function setMode(mode){const selected=mode==="professional"?"professional":"simple";body.dataset.surayaMode=selected;tools.querySelectorAll("[data-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===selected)));safeWrite(modeKey,selected)}
 tools.addEventListener("click",e=>{const b=e.target.closest("[data-mode]");if(b)setMode(b.dataset.mode)});
 function applyWallpaper(data){if(data){wall.style.backgroundImage='linear-gradient(145deg,rgba(5,12,24,.76),rgba(5,12,24,.62)),url("'+data+'")';body.dataset.surayaWallpaper="true";$("surayaWallpaperReset").hidden=false}else{wall.style.backgroundImage="";body.dataset.surayaWallpaper="false";$("surayaWallpaperReset").hidden=true}}
 const $=id=>document.getElementById(id),file=$("surayaWallpaperFile");
 $("surayaWallpaperOpen").addEventListener("click",()=>file.click());
 file.addEventListener("change",async()=>{const f=file.files&&file.files[0];if(!f)return;if(!f.type.startsWith("image/")){alert("فقط فایل تصویری انتخاب کن.");file.value="";return}if(f.size>12*1024*1024){alert("حجم تصویر باید کمتر از ۱۲ مگابایت باشد.");file.value="";return}
  try{const bitmap=await createImageBitmap(f),scale=Math.min(1,1920/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const data=canvas.toDataURL("image/jpeg",.8);if(!safeWrite(wallKey,data))throw new Error("storage");applyWallpaper(data)}catch{alert("ذخیرهٔ تصویر ممکن نشد؛ تصویر کوچک‌تری انتخاب کن.")}finally{file.value=""}
 });
 $("surayaWallpaperReset").addEventListener("click",()=>{try{localStorage.removeItem(wallKey)}catch{}applyWallpaper("")});
 setMode(safeRead(modeKey)||"simple");applyWallpaper(safeRead(wallKey));
 const groups={content:"محتوا و خلاقیت",growth:"مدیریت و رشد کسب‌وکار"};
 const groupFor=code=>["social_content","business_content","product_descriptions"].includes(code)?"content":"growth";
 function groupRows(host,selector,headingClass,items){
  if(!host)return;const rows=Array.from(host.querySelectorAll(":scope > "+selector));
  const signature=rows.map((row,index)=>row.dataset.serviceCode||items[index]?.[0]||"").join("|");
  if(host.dataset[headingClass+"Signature"]===signature)return;
  host.querySelectorAll("."+headingClass).forEach(n=>n.remove());let previous="";
  rows.forEach((row,index)=>{const code=row.dataset.serviceCode||items[index]?.[0]||"";row.dataset.serviceCode=code;const group=groupFor(code);if(group!==previous){const h=document.createElement("div");h.className=headingClass;h.textContent=groups[group];host.insertBefore(h,row);previous=group}});
  host.dataset[headingClass+"Signature"]=signature;
 }
 const serviceList=$("serviceList"),drawer=$("drawerServices");
 function refreshGroups(){const catalog=window.surayaCatalog||{};const items=Object.entries(catalog);groupRows(serviceList,".service-row","service-group-title",items);groupRows(drawer,".drawer-service","drawer-group-title",items)}
 [serviceList,drawer].forEach(host=>{if(host)new MutationObserver(()=>refreshGroups()).observe(host,{childList:true})});
 refreshGroups();
 const serviceIntro=document.querySelector("#services .stage-tag");if(serviceIntro)serviceIntro.textContent="۷ روز استفاده رایگان";
 const paywall=$("paywallOverlay");if(paywall){const p=paywall.querySelector("p");if(p)p.textContent="با تهیهٔ اشتراک و پرداخت هزینهٔ اشتراک، دورهٔ ۷ روزهٔ استفاده فعال می‌شود."}
})();
