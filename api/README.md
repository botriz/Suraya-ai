# 📡 API ثریا

## مسیرهای اصلی

### وضعیت
```
GET /api/status
```

### هوش مصنوعی
```
POST /api/ai/generate-text
POST /api/ai/generate-image
POST /api/ai/generate-video
```

### بلاکچین
```
GET  /api/blockchain/status
POST /api/blockchain/transfer
GET  /api/blockchain/balance/:address
```

### جهان
```
GET /api/world/entities
GET /api/world/entity/:id
GET /api/world/cities
```

### مأموریت‌ها
```
GET  /api/missions
POST /api/missions/:id/accept
POST /api/missions/:id/complete
```

### بازار
```
GET  /api/market/tokens
GET  /api/market/orders
POST /api/market/orders
```
