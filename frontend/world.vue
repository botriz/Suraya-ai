<!--
═══════════════════════════════════════════════════════════════
SURAYA WORLD PAGE  –  رابط اصلی جهان
═══════════════════════════════════════════════════════════════
-->
<template>
  <div class="world-container">
    <div class="world-viewport">
      <div class="viewport-placeholder">
        <h2>🌐 جهان ثریا</h2>
        <p>نمایش سه‌بعدی جهان (Three.js / Babylon.js)</p>
        <div class="stats-bar">
          <span>موجودیت‌ها: {{ entityCount }}</span>
          <span>بازیکنان فعال: {{ activePlayers }}</span>
          <span>ARZA در گردش: {{ circulatingARZA }}</span>
          <span>سلامت شبکه: {{ networkHealth }}%</span>
        </div>
      </div>
    </div>

    <aside class="sidebar">
      <section class="panel">
        <h3>📊 آمار زنده</h3>
        <ul>
          <li>ارتفاع زنجیره: {{ chainHeight }}</li>
          <li>نودها: {{ nodeCount }}</li>
          <li>مأموریت‌های باز: {{ openMissions }}</li>
        </ul>
      </section>

      <section class="panel">
        <h3>🎯 مأموریت‌ها</h3>
        <div v-for="m in missions" :key="m.id" class="mission-card">
          <strong>{{ m.title }}</strong>
          <small>{{ m.entity }} · سختی {{ m.difficulty }}</small>
          <p>{{ m.description }}</p>
          <button @click="accept(m)">قبول</button>
          <button @click="complete(m.id)" class="secondary">تکمیل</button>
        </div>
        <p v-if="!missions.length" class="empty">مأموریتی موجود نیست</p>
      </section>

      <section class="panel">
        <h3>💎 والت</h3>
        <div class="balance">{{ balance }} ARZA</div>
        <div class="nfts" v-if="nfts.length">
          <span v-for="n in nfts" :key="n" class="nft-tag">{{ n }}</span>
        </div>
      </section>
    </aside>

    <div class="notifications">
      <div v-for="n in notes" :key="n.id" class="note" :class="n.type">
        {{ n.icon }} {{ n.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const entityCount = ref(0)
const activePlayers = ref(0)
const circulatingARZA = ref(0)
const networkHealth = ref(100)
const chainHeight = ref(1)
const nodeCount = ref(0)
const openMissions = ref(0)
const balance = ref(0)
const nfts = ref([])
const missions = ref([])
const notes = reactive([])

function accept(m) {
  addNote('success', `مأموریت «${m.title}» قبول شد`, '⭐')
}
function complete(id) {
  addNote('success', `مأموریت تکمیل شد – پاداش ARZA دریافت شد`, '💎')
  missions.value = missions.value.filter(x => x.id !== id)
  openMissions.value = missions.value.length
}
function addNote(type, message, icon) {
  const id = Date.now()
  notes.push({ id, type, message, icon })
  setTimeout(() => {
    const i = notes.findIndex(n => n.id === id)
    if (i > -1) notes.splice(i, 1)
  }, 4500)
}

onMounted(() => {
  missions.value = [
    { id: 'farm-1', title: 'کشاورزی و بذرپاشی', entity: 'خاک‌دانه', difficulty: 3, description: 'مزرعه دیجیتال پرورش دهید' },
    { id: 'water-1', title: 'مدیریت منابع آبی', entity: 'آب‌دولت', difficulty: 4, description: 'چاه حفر و آب توزیع کنید' }
  ]
  openMissions.value = missions.value.length
  entityCount.value = 14
  activePlayers.value = 3
  circulatingARZA.value = 125000
  balance.value = 2500
})
</script>

<style scoped>
.world-container {
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  font-family: 'Vazirmatn', system-ui, sans-serif;
  direction: rtl;
  color: #e2e8f0;
}
.world-viewport { flex: 1; display: flex; align-items: center; justify-content: center; }
.viewport-placeholder { text-align: center; opacity: 0.85; }
.viewport-placeholder h2 { font-size: 2rem; margin-bottom: 0.5rem; }
.stats-bar { display: flex; gap: 1.5rem; margin-top: 1.5rem; flex-wrap: wrap; justify-content: center; font-size: 0.9rem; color: #94a3b8; }

.sidebar {
  width: 340px;
  background: rgba(15, 23, 42, 0.92);
  border-right: 1px solid #334155;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.panel {
  background: rgba(30, 41, 59, 0.7);
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid #334155;
}
.panel h3 { margin: 0 0 0.75rem; font-size: 1rem; color: #38bdf8; }
.panel ul { list-style: none; padding: 0; margin: 0; font-size: 0.9rem; }
.panel li { padding: 0.25rem 0; color: #cbd5e1; }

.mission-card {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 0.6rem;
  border: 1px solid #475569;
}
.mission-card strong { display: block; color: #f1f5f9; }
.mission-card small { color: #94a3b8; font-size: 0.75rem; }
.mission-card p { font-size: 0.8rem; margin: 0.4rem 0; color: #cbd5e1; }
.mission-card button {
  margin-left: 0.4rem;
  padding: 0.3rem 0.7rem;
  border: none;
  border-radius: 6px;
  background: #0ea5e9;
  color: #fff;
  cursor: pointer;
  font-size: 0.8rem;
}
.mission-card button.secondary { background: #334155; }
.empty { color: #64748b; font-size: 0.85rem; }

.balance { font-size: 1.4rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.5rem; }
.nft-tag {
  display: inline-block;
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  margin: 0.15rem;
}

.notifications {
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 50;
}
.note {
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  font-size: 0.9rem;
  min-width: 260px;
  animation: slideIn 0.3s ease;
}
.note.success { border-color: #22c55e; }
.note.info { border-color: #38bdf8; }
@keyframes slideIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
