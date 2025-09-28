# Serverless Database Issues & Solutions

## 🚨 **Masalah yang Sering Terjadi di Serverless**

### **1. "prepared statement does not exist" Error**
```
Error: prepared statement "s8" does not exist
Error: prepared statement "s2" already exists
```

**Penyebab:**
- Serverless functions "sleep" setelah tidak digunakan
- Connection pool Prisma expired saat function "bangun" lagi
- Prepared statements menjadi invalid

### **2. Connection Pool Exhaustion**
- Supabase memiliki limit koneksi
- Multiple concurrent requests
- Connection tidak di-cleanup dengan benar

### **3. Cold Start Issues**
- Function pertama kali dijalankan lebih lambat
- Database connection timeout
- Memory leaks

## ✅ **Solusi yang Sudah Diimplementasi**

### **1. Serverless-Safe Prisma Client**
```typescript
// src/lib/prisma.ts
- Fresh connection untuk setiap request di production
- Global instance di development
- Proper connection cleanup
- Timeout configuration
```

### **2. Serverless Database Wrapper**
```typescript
// src/lib/serverless-db.ts
- withServerlessDB() function
- Automatic retry logic
- Connection health check
- Safe disconnect
```

### **3. Updated API Routes**
```typescript
// Menggunakan withServerlessDB() instead of withRetry()
const products = await withServerlessDB(async (prisma) => {
  return prisma.product.findMany({...});
});
```

## 🔧 **Cara Mengatasi Error yang Masih Terjadi**

### **Option 1: Restart Development Server**
```bash
# Stop server (Ctrl+C)
npm run dev
```

### **Option 2: Clear Browser Cache**
- F12 → Right-click refresh → "Empty Cache and Hard Reload"

### **Option 3: Test Database Connection**
Akses: `http://localhost:3000/api/test-db`

### **Option 4: Update Environment Variables**
Pastikan di `.env`:
```env
DATABASE_URL="postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres"
```

## 🚀 **Best Practices untuk Serverless**

### **1. Connection Management**
- ✅ Fresh connection per request (production)
- ✅ Proper cleanup dengan `$disconnect()`
- ✅ Connection health check
- ✅ Retry logic untuk transient errors

### **2. Error Handling**
- ✅ Catch prepared statement errors
- ✅ Retry dengan fresh connection
- ✅ Graceful degradation
- ✅ Proper logging

### **3. Performance Optimization**
- ✅ Connection pooling di Supabase
- ✅ Query optimization
- ✅ Proper indexing
- ✅ Timeout configuration

## 📊 **Monitoring & Debugging**

### **Check Connection Status**
```bash
curl http://localhost:3000/api/test-db
```

### **Check Supabase Logs**
1. Buka Supabase Dashboard
2. Go to Logs
3. Check for connection errors

### **Check Vercel Logs** (jika deploy)
1. Buka Vercel Dashboard
2. Go to Functions tab
3. Check error logs

## 🎯 **Expected Behavior**

### **Normal Operation:**
- ✅ API calls work consistently
- ✅ No prepared statement errors
- ✅ Fast response times
- ✅ Proper error handling

### **When Issues Occur:**
- ⚠️ Occasional errors (normal in serverless)
- ⚠️ Automatic retry should fix most issues
- ⚠️ Fresh connection per request

## 🔄 **Migration Strategy**

### **Phase 1: Update Critical APIs**
- ✅ Products API (already updated)
- 🔄 Orders API
- 🔄 Deliveries API
- 🔄 Inventory API

### **Phase 2: Test & Monitor**
- Monitor error rates
- Check performance
- Verify stability

### **Phase 3: Full Migration**
- Update all remaining APIs
- Remove old withRetry usage
- Clean up unused code

## 🚨 **Emergency Fix**

Jika error masih sering terjadi:

### **Quick Fix:**
```bash
# Regenerate Prisma client
npx prisma generate

# Restart server
npm run dev

# Test connection
curl http://localhost:3000/api/test-db
```

### **Alternative: Use Direct Connection**
Di Supabase Dashboard:
1. Go to Settings > Database
2. Enable "Connection Pooling"
3. Use pooled connection URL

## 📈 **Performance Tips**

### **1. Optimize Queries**
- Use `select` to limit fields
- Add proper indexes
- Use pagination for large datasets

### **2. Connection Pooling**
- Enable in Supabase
- Use pooled connection URL
- Monitor connection usage

### **3. Caching**
- Cache frequently accessed data
- Use Redis for session data
- Implement query result caching

## 🎉 **Success Metrics**

Setelah implementasi:
- ✅ Error rate < 1%
- ✅ Response time < 500ms
- ✅ 99.9% uptime
- ✅ No prepared statement errors
