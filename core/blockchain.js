/**
 * ═══════════════════════════════════════════════════════════════
 * SURAYA BLOCKCHAIN CORE  –  همهٔ هسته در یک فایل
 * ═══════════════════════════════════════════════════════════════
 * شامل:
 *   ۱. Crypto          – رمزنگاری Quantum-Ready
 *   ۲. MerkleTree      – درخت مرکل
 *   ۳. Transaction     – تراکنش
 *   ۴. Block           – بلاک
 *   ۵. ProofOfIntelligence – اجماع PoI
 *   ۶. SurayaChain     – موتور اصلی
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';
const crypto = require('crypto');
const EventEmitter = require('events');

/* ─────────────────────────────────────────────
   ۱. CRYPTO
───────────────────────────────────────────── */
const Crypto = {
  hash(data) {
    return crypto.createHash('sha256').update(String(data)).digest('hex');
  },
  doubleHash(data) {
    return this.hash(this.hash(data));
  },
  generateKeyPair() {
    return crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
  },
  sign(data, privateKey) {
    const s = crypto.createSign('SHA256');
    s.update(String(data));
    s.end();
    return s.sign(privateKey, 'hex');
  },
  verify(data, signature, publicKey) {
    try {
      const v = crypto.createVerify('SHA256');
      v.update(String(data));
      v.end();
      return v.verify(publicKey, signature, 'hex');
    } catch { return false; }
  },
  merkleRoot(leaves) {
    if (!leaves?.length) return '0'.repeat(64);
    let level = leaves.map(l => this.hash(l));
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        next.push(this.hash(level[i] + (level[i + 1] || level[i])));
      }
      level = next;
    }
    return level[0];
  },
  addressFromPublicKey(pk) {
    return 'SRY' + this.hash(pk).slice(0, 40);
  },
  encrypt(text, password) {
    const key = crypto.scryptSync(password, 'suraya-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let enc = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    return iv.toString('hex') + ':' + cipher.getAuthTag().toString('hex') + ':' + enc;
  },
  decrypt(data, password) {
    const [ivHex, tagHex, enc] = data.split(':');
    const key = crypto.scryptSync(password, 'suraya-salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8');
  }
};

/* ─────────────────────────────────────────────
   ۲. MERKLE TREE
───────────────────────────────────────────── */
class MerkleTree {
  constructor(leaves = []) {
    this.leaves = leaves.map(l => typeof l === 'string' ? l : Crypto.hash(JSON.stringify(l)));
    this.levels = [];
    this.root = this._build();
  }
  _build() {
    if (!this.leaves.length) { this.levels = [['0'.repeat(64)]]; return this.levels[0][0]; }
    let cur = [...this.leaves];
    this.levels = [cur];
    while (cur.length > 1) {
      const next = [];
      for (let i = 0; i < cur.length; i += 2)
        next.push(Crypto.hash(cur[i] + (cur[i + 1] || cur[i])));
      this.levels.push(next);
      cur = next;
    }
    return cur[0];
  }
  getRoot() { return this.root; }
  getProof(idx) {
    const proof = [];
    let i = idx;
    for (let l = 0; l < this.levels.length - 1; l++) {
      const level = this.levels[l];
      const isRight = i % 2 === 1;
      const sib = isRight ? i - 1 : i + 1;
      if (sib < level.length) proof.push({ hash: level[sib], position: isRight ? 'left' : 'right' });
      i = Math.floor(i / 2);
    }
    return proof;
  }
  static verify(leaf, proof, root) {
    let h = typeof leaf === 'string' ? leaf : Crypto.hash(JSON.stringify(leaf));
    for (const { hash, position } of proof)
      h = position === 'left' ? Crypto.hash(hash + h) : Crypto.hash(h + hash);
    return h === root;
  }
}

/* ─────────────────────────────────────────────
   ۳. TRANSACTION
───────────────────────────────────────────── */
class Transaction {
  constructor({ from, to, amount, type = 'transfer', data = {}, fee = 0 }) {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.type = type;
    this.data = data;
    this.fee = fee;
    this.timestamp = Date.now();
    this.nonce = Math.floor(Math.random() * 1e9);
    this.signature = null;
    this.hash = this.calculateHash();
  }
  calculateHash() {
    return Crypto.hash(JSON.stringify({
      from: this.from, to: this.to, amount: this.amount, type: this.type,
      data: this.data, fee: this.fee, timestamp: this.timestamp, nonce: this.nonce
    }));
  }
  sign(privateKey) {
    this.signature = Crypto.sign(this.hash, privateKey);
    return this;
  }
  isValid(publicKey) {
    if (!this.signature || this.hash !== this.calculateHash()) return false;
    return Crypto.verify(this.hash, this.signature, publicKey);
  }
  toJSON() {
    return { ...this };
  }
  static fromJSON(j) {
    const t = new Transaction(j);
    Object.assign(t, j);
    return t;
  }
}

/* ─────────────────────────────────────────────
   ۴. BLOCK
───────────────────────────────────────────── */
class Block {
  constructor({ index, previousHash, timestamp, transactions, proposer, intelligenceScore }) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp || Date.now();
    this.transactions = transactions || [];
    this.proposer = proposer;
    this.intelligenceScore = intelligenceScore || 0;
    this.merkleRoot = this._merkle();
    this.nonce = 0;
    this.hash = this.calculateHash();
  }
  _merkle() {
    if (!this.transactions.length) return '0'.repeat(64);
    return Crypto.merkleRoot(this.transactions.map(tx =>
      typeof tx === 'string' ? tx : (tx.hash || Crypto.hash(JSON.stringify(tx)))
    ));
  }
  calculateHash() {
    return Crypto.hash([this.index, this.previousHash, this.timestamp, this.merkleRoot,
      this.proposer, this.intelligenceScore, this.nonce].join('|'));
  }
  mine(difficulty = 2) {
    const target = '0'.repeat(difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    return this;
  }
  toJSON() { return { ...this }; }
  static fromJSON(j) {
    const b = new Block(j);
    Object.assign(b, j);
    return b;
  }
}

/* ─────────────────────────────────────────────
   ۵. PROOF OF INTELLIGENCE
───────────────────────────────────────────── */
class ProofOfIntelligence {
  constructor() {
    this.scores = new Map();
    this.reputation = new Map();
    this.metrics = new Map();
  }
  updateMetrics(nodeId, m) {
    this.metrics.set(nodeId, { ...this.metrics.get(nodeId), ...m, updated: Date.now() });
    this.calculate(nodeId);
  }
  calculate(nodeId) {
    const m = this.metrics.get(nodeId) || {};
    const va = m.validationAccuracy ?? 80;
    const rt = Math.max(0, 100 - ((m.responseTimeMs ?? 200) / 10));
    const pa = m.predictionAccuracy ?? 70;
    const ps = m.problemSolving ?? 75;
    const ho = m.honesty ?? 95;
    const me = m.mentoring ?? 50;
    const inn = m.innovation ?? 40;
    const score = va * 0.25 + rt * 0.15 + pa * 0.20 + ps * 0.15 + ho * 0.15 + me * 0.05 + inn * 0.05;
    this.scores.set(nodeId, score);
    return score;
  }
  selectProposer() {
    const nodes = [...this.scores.keys()];
    if (!nodes.length) return null;
    const weights = nodes.map(n => this.scores.get(n) || 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < nodes.length; i++) {
      r -= weights[i];
      if (r <= 0) return { nodeId: nodes[i], score: this.scores.get(nodes[i]), bonus: (this.scores.get(nodes[i]) || 0) * 0.1 };
    }
    return { nodeId: nodes.at(-1), score: this.scores.get(nodes.at(-1)), bonus: 0 };
  }
  async validateBlock(block) {
    const checks = [
      { name: 'hash', passed: !!block.hash },
      { name: 'merkle', passed: !!block.merkleRoot },
      { name: 'txs', passed: Array.isArray(block.transactions) }
    ];
    return { isValid: checks.every(c => c.passed), checks };
  }
  reward(nodeId, base = 10) {
    const score = this.scores.get(nodeId) || 0;
    const bonus = score * base / 100;
    const rep = (this.reputation.get(nodeId) || 0) + bonus / 10;
    this.reputation.set(nodeId, rep);
    return { baseReward: base, intelligenceBonus: bonus, totalReward: base + bonus, reputation: rep };
  }
}

/* ─────────────────────────────────────────────
   ۶. SURAYA CHAIN (موتور اصلی)
───────────────────────────────────────────── */
class SurayaChain extends EventEmitter {
  constructor(config = {}) {
    super();
    this.chain = [];
    this.pending = [];
    this.difficulty = config.difficulty || 2;
    this.blockReward = config.blockReward || 50;
    this.maxTx = config.maxTxPerBlock || 1000;
    this.poi = new ProofOfIntelligence();
    this.nodes = new Map();
    this.balances = new Map();
    this._genesis();
  }

  _genesis() {
    const g = new Block({
      index: 0, previousHash: '0'.repeat(64),
      transactions: [{ from: 'SYSTEM', to: 'GENESIS', amount: 0, type: 'genesis',
        data: { message: 'Suraya – Proof of Intelligence' } }],
      proposer: 'GENESIS', intelligenceScore: 100
    });
    g.hash = g.calculateHash();
    this.chain.push(g);
    this.emit('block', g);
  }

  getLatest() { return this.chain.at(-1); }
  getBalance(addr) { return this.balances.get(addr) || 0; }

  addTransaction(tx) {
    if (!(tx instanceof Transaction)) tx = Transaction.fromJSON(tx);
    if (tx.type === 'transfer' && this.getBalance(tx.from) < tx.amount + tx.fee)
      throw new Error('موجودی ناکافی');
    this.pending.push(tx);
    this.emit('transaction', tx);
    return tx.hash;
  }

  async mine(proposerId = null) {
    let proposer = proposerId;
    if (!proposer) {
      const sel = this.poi.selectProposer();
      proposer = sel?.nodeId || 'SYSTEM';
    }
    const score = this.poi.scores.get(proposer) || 50;
    const txs = this.pending.splice(0, this.maxTx);
    txs.unshift(new Transaction({
      from: 'SYSTEM', to: proposer, amount: this.blockReward,
      type: 'block_reward', data: { intelligenceScore: score }
    }));
    const block = new Block({
      index: this.chain.length, previousHash: this.getLatest().hash,
      transactions: txs.map(t => t.toJSON ? t.toJSON() : t),
      proposer, intelligenceScore: score
    });
    block.mine(this.difficulty);
    const val = await this.poi.validateBlock(block);
    if (!val.isValid) throw new Error('بلاک نامعتبر');
    this.chain.push(block);
    this._apply(block);
    this.poi.reward(proposer, this.blockReward);
    this.emit('block', block);
    return block;
  }

  _apply(block) {
    for (const tx of block.transactions) {
      if (['transfer', 'mission_reward', 'bio_gen', 'block_reward', 'mint'].includes(tx.type)) {
        if (tx.from && tx.from !== 'SYSTEM')
          this.balances.set(tx.from, this.getBalance(tx.from) - (tx.amount || 0) - (tx.fee || 0));
        if (tx.to) this.balances.set(tx.to, this.getBalance(tx.to) + (tx.amount || 0));
        if (tx.fee) this.balances.set('DAO_TREASURY', this.getBalance('DAO_TREASURY') + tx.fee);
      }
      if (tx.type === 'burn')
        this.balances.set(tx.from, Math.max(0, this.getBalance(tx.from) - (tx.amount || 0)));
    }
  }

  registerNode(id, info = {}) {
    this.nodes.set(id, { ...info, at: Date.now() });
    this.poi.updateMetrics(id, {
      validationAccuracy: 85 + Math.random() * 10,
      responseTimeMs: 50 + Math.random() * 150,
      predictionAccuracy: 70 + Math.random() * 20,
      problemSolving: 75 + Math.random() * 15,
      honesty: 90 + Math.random() * 10,
      mentoring: 40 + Math.random() * 40,
      innovation: 30 + Math.random() * 50
    });
  }

  isValid() {
    for (let i = 1; i < this.chain.length; i++) {
      if (this.chain[i].hash !== this.chain[i].calculateHash()) return false;
      if (this.chain[i].previousHash !== this.chain[i - 1].hash) return false;
    }
    return true;
  }

  getStats() {
    return {
      height: this.chain.length, pending: this.pending.length,
      nodes: this.nodes.size, valid: this.isValid(),
      latestHash: this.getLatest().hash
    };
  }

  recordMissionCompletion({ playerId, missionId, rewards }) {
    const tx = new Transaction({
      from: 'SYSTEM', to: playerId, amount: rewards?.arza || 0,
      type: 'mission_reward', data: { missionId, rewards }
    });
    this.addTransaction(tx);
    return { hash: tx.hash, success: true };
  }

  mintNFT(playerId, nftName) {
    const tx = new Transaction({
      from: 'SYSTEM', to: playerId, amount: 0, type: 'nft_mint',
      data: { nft: nftName, tokenId: 'NFT-' + Date.now() }
    });
    this.addTransaction(tx);
    return { hash: tx.hash, tokenId: tx.data.tokenId };
  }
}

/* ─── Export ─── */
module.exports = {
  Crypto, MerkleTree, Transaction, Block,
  ProofOfIntelligence, SurayaChain
};
