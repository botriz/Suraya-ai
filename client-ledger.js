// client-ledger.js — simple client-side ledger stored in localStorage (prototype-safe admin)
(function(){
  const KEY = 'suraya_ledger_v1';
  const LAST_WORK_KEY = 'suraya_last_work_v1';
  const ADMIN_KEY = 'suraya_admin_pass_v1'; // stored locally for prototype only

  function nowISO(){ return new Date().toISOString(); }

  const Ledger = window.Ledger = {
    init(){
      if (!localStorage.getItem(KEY)) {
        const state = { txs: [], userId: 'guest-' + Date.now() };
        localStorage.setItem(KEY, JSON.stringify(state));
      }
      if (!localStorage.getItem(LAST_WORK_KEY)) localStorage.setItem(LAST_WORK_KEY, '0');
    },

    getState(){
      try { return JSON.parse(localStorage.getItem(KEY)); } catch(e){ return {txs:[], userId:'guest-'+Date.now()}; }
    },

    setState(s){ localStorage.setItem(KEY, JSON.stringify(s)); },

    addTransaction({type='reward', amount=0, note='' } = {}){
      const s = this.getState();
      const tx = { id: 'tx-' + Date.now() + '-' + Math.floor(Math.random()*9999), type, amount, note, timestamp: nowISO() };
      s.txs.push(tx);
      this.setState(s);
      return tx;
    },

    getHistory(){ const s = this.getState(); return s.txs || []; },

    getBalance(){ const s = this.getState(); return (s.txs || []).reduce((acc,t)=> acc + (t.type === 'reward' || t.type === 'mint' ? t.amount : -Math.abs(t.amount)), 0); },

    mint(amount, note = 'mint'){
      return this.addTransaction({ type: 'mint', amount: amount, note });
    },

    canWork(){
      const last = parseInt(localStorage.getItem(LAST_WORK_KEY) || '0', 10);
      const now = Date.now();
      // simple cooldown 5 seconds to reduce spam in prototype
      return (now - last) > 5000;
    },

    updateLastWorkTimestamp(){ localStorage.setItem(LAST_WORK_KEY, ''+Date.now()); },

    // Admin password helpers (prototype-only; stored locally)
    isAdminSet(){ return !!localStorage.getItem(ADMIN_KEY); },
    setAdminPassword(pass){ if(!pass) return false; localStorage.setItem(ADMIN_KEY, pass); return true; },
    getAdminPassword(){ return localStorage.getItem(ADMIN_KEY); },
    clearAdminPassword(){ localStorage.removeItem(ADMIN_KEY); }
  };

})();
