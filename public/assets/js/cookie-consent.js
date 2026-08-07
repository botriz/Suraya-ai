/* cookie-consent.js
 * Simple client-side consent banner + settings modal.
 * - Shows on first visit if no cookie_consent exists
 * - POSTs selection to /api/cookies/consent
 */

(function(){
  function qs(sel, ctx){ return (ctx||document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.from((ctx||document).querySelectorAll(sel)); }

  function readCookie(name){
    const v = document.cookie.split('; ').find(r=>r.startsWith(name+'='));
    if(!v) return null; return decodeURIComponent(v.split('=')[1]);
  }

  function showBanner(){
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = `
      <div class="cookie-inner">
        <div class="cookie-left">
          <strong>ما برای بهبود تجربه‌تان از کوکی‌ها استفاده می‌کنیم</strong>
          <div class="cookie-text">برای ارائهٔ خدمات و تحلیل و سفارشی‌سازی محتوا، از کوکی‌ها استفاده می‌کنیم. شما می‌توانید نوع کوکی‌ها را مدیریت کنید.</div>
        </div>
        <div class="cookie-actions">
          <button class="btn accept-all">قبول همه</button>
          <button class="btn manage">مدیریت</button>
          <button class="btn reject">رد همه</button>
        </div>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('.accept-all').addEventListener('click', ()=>submitConsent({ analytics:true, marketing:true, preferences:true }));
    banner.querySelector('.reject').addEventListener('click', ()=>submitConsent({ analytics:false, marketing:false, preferences:false }));
    banner.querySelector('.manage').addEventListener('click', ()=>openSettings(banner));
  }

  function openSettings(banner){
    // simple modal
    let modal = qs('.cookie-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.className = 'cookie-modal';
      modal.innerHTML = `
        <div class="cookie-modal-inner">
          <h3>تنظیمات کوکی‌ها</h3>
          <label><input type="checkbox" name="analytics"> تحلیل و آمار</label>
          <label><input type="checkbox" name="marketing"> بازاریابی</label>
          <label><input type="checkbox" name="preferences"> تنظیمات و ترجیحات</label>
          <div class="cookie-modal-actions">
            <button class="btn save">ذخیره</button>
            <button class="btn cancel">لغو</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      modal.querySelector('.save').addEventListener('click', ()=>{
        const analytics = modal.querySelector('input[name=analytics]').checked;
        const marketing = modal.querySelector('input[name=marketing]').checked;
        const preferences = modal.querySelector('input[name=preferences]').checked;
        submitConsent({ analytics, marketing, preferences });
        closeModal(modal, banner);
      });
      modal.querySelector('.cancel').addEventListener('click', ()=>closeModal(modal,banner));
    }
    modal.style.display='flex';
    if(banner) banner.style.display='none';
  }

  function closeModal(modal,banner){ if(modal){ modal.style.display='none'; } if(banner){ banner.style.display='none'; } }

  async function submitConsent(body){
    try{
      await fetch('/api/cookies/consent', {
        method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body)
      });
      // if analytics allowed, try loading analytics loader if present
      if(body.analytics && window.loadAnalytics) window.loadAnalytics();
      removeBanner();
    }catch(e){ console.error('consent submit failed', e); }
  }

  function removeBanner(){ const b = qs('.cookie-banner'); if(b) b.remove(); }

  // init
  if(!readCookie('cookie_consent')){
    document.addEventListener('DOMContentLoaded', showBanner);
  }
})();
