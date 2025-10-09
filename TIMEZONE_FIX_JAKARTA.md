# Timezone Fix: Asia/Jakarta (UTC+7)

## Tanggal
9 Oktober 2025

## Masalah yang Diperbaiki

### Sebelum Fix:
1. **Tanggal berubah saat save**: Misal set tanggal 27 Oktober tapi di database jadi 26 Oktober
2. **Jam jadi 17:00:00 di database**: Karena UTC conversion yang salah (27 Oct 00:00 Asia/Jakarta → 26 Oct 17:00 UTC)
3. **Filter tanggal ngaco**: Kadang tanggal masuk ke hari sebelumnya/selanjutnya
4. **Tidak konsisten**: Beberapa tempat adjust timezone, beberapa tidak

### Akar Masalah:
- **Asia/Jakarta = UTC+7**
- Ketika convert local time (Jakarta) ke UTC tanpa proper handling: `27 Oct 00:00 Jakarta → 26 Oct 17:00 UTC`
- Saat ditampilkan kembali: `26 Oct 17:00 UTC → 27 Oct 00:00 Jakarta` (tapi kalau tidak di-convert balik, akan tampil sebagai 26 Oct)

## Solusi Implementasi

### 1. Timezone Utility Functions ✅

**File Baru**: `src/lib/timezone.ts`

Berisi helper functions untuk handle timezone Asia/Jakarta:

```typescript
// Convert local date to UTC for Jakarta timezone
toUTCForJakarta(date: Date): Date

// Get start of day (00:00:00) in Jakarta timezone as UTC
getStartOfDayJakarta(date: Date): Date

// Get end of day (23:59:59.999) in Jakarta timezone as UTC
getEndOfDayJakarta(date: Date): Date

// Convert UTC to Jakarta display
fromUTCToJakarta(utcDate: Date): Date

// Format date for Jakarta timezone
formatJakartaDate(date: Date | string): string
```

**Cara Kerja:**
```typescript
// User pilih: 27 Oktober 2024 00:00
const inputDate = new Date(2024, 9, 27, 0, 0, 0); // Local: 27 Oct 00:00

// Convert ke UTC untuk Jakarta (kurangi 7 jam)
const utcDate = toUTCForJakarta(inputDate);
// Result: 26 Oct 17:00 UTC (ini benar!)

// Di database tersimpan: 2024-10-26T17:00:00.000Z
// Saat dibaca: UTC menambah 7 jam → 27 Oct 00:00 Jakarta ✅
```

### 2. Frontend Changes

#### **Orders Page** (`src/app/orders/page.tsx`)
```typescript
import { toUTCForJakarta, getStartOfDayJakarta, getEndOfDayJakarta } from "../../lib/timezone";

// Saat filter orders
const loadOrders = async () => {
  if (from) {
    const fromJakarta = getStartOfDayJakarta(from); // 00:00:00 Jakarta → UTC
    params.set("from", fromJakarta.toISOString());
  }
  if (to) {
    const toJakarta = getEndOfDayJakarta(to); // 23:59:59 Jakarta → UTC
    params.set("to", toJakarta.toISOString());
  }
};

// Saat create/edit order
const submitOrder = async () => {
  const orderDateUTC = toUTCForJakarta(form.orderDate);
  const payload = {
    orderDate: orderDateUTC.toISOString(), // Simpan sebagai UTC
    // ...
  };
};
```

#### **Reports Page** (`src/app/reports/page.tsx`)
```typescript
import { getStartOfDayJakarta, getEndOfDayJakarta } from "../../lib/timezone";

const load = async () => {
  if (from) {
    const fromJakarta = getStartOfDayJakarta(from);
    qs.push(`from=${encodeURIComponent(fromJakarta.toISOString())}`);
  }
  if (to) {
    const toJakarta = getEndOfDayJakarta(to);
    qs.push(`to=${encodeURIComponent(toJakarta.toISOString())}`);
  }
};
```

#### **Sales Page** (`src/app/sales/page.tsx`)
```typescript
import { getStartOfDayJakarta, getEndOfDayJakarta } from "../../lib/timezone";

const loadSales = async () => {
  if (from) {
    const fromJakarta = getStartOfDayJakarta(from);
    params.set("from", fromJakarta.toISOString());
  }
  if (to) {
    const toJakarta = getEndOfDayJakarta(to);
    params.set("to", toJakarta.toISOString());
  }
};
```

### 3. Backend API Changes

**Semua API yang handle date filter diupdate:**

#### **Orders API** (`src/app/api/orders/route.ts`)
```typescript
// SEBELUM:
if (from) {
  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0); // ❌ SALAH - adjust lagi
  where.orderDate.gte = fromDate;
}

// SESUDAH:
if (from) {
  // Frontend sudah kirim UTC yang sudah di-adjust
  where.orderDate.gte = new Date(from); // ✅ Langsung pakai
}
```

#### Files Updated:
- ✅ `src/app/api/orders/route.ts`
- ✅ `src/app/api/reports/sales/route.ts`
- ✅ `src/app/api/reports/menu-items/route.ts`
- ✅ `src/app/api/sales/route.ts`

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ USER INPUT                                                  │
│ Pilih tanggal: 27 Oktober 2024                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (timezone.ts)                                      │
│ getStartOfDayJakarta() atau toUTCForJakarta()              │
│                                                             │
│ 27 Oct 2024 00:00:00 Jakarta                               │
│          ↓ (kurangi 7 jam)                                  │
│ 26 Oct 2024 17:00:00 UTC                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ API REQUEST                                                 │
│ GET /api/orders?from=2024-10-26T17:00:00.000Z              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND API                                                 │
│ where.orderDate.gte = new Date(from)                        │
│ Langsung pakai (sudah UTC yang benar)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE QUERY                                              │
│ WHERE orderDate >= '2024-10-26T17:00:00.000Z'              │
│                                                             │
│ Mencari semua order dari 27 Oct 00:00 Jakarta ke atas ✅   │
└─────────────────────────────────────────────────────────────┘
```

## Testing Scenarios

### Test Case 1: Create Order dengan Tanggal Spesifik
1. Buka Orders page
2. Create order, pilih tanggal: **27 Oktober 2024**
3. Submit order
4. **Verifikasi Database**: 
   - Query: `SELECT orderDate FROM "Order" ORDER BY id DESC LIMIT 1`
   - Expected: `2024-10-26T17:00:00.000Z` (ini benar untuk 27 Oct Jakarta!)
5. **Verifikasi Display**: Order date tetap tampil sebagai **27 Oktober 2024**

### Test Case 2: Filter Orders by Date Range
1. Buka Orders page
2. Set filter:
   - From: **1 Oktober 2024**
   - To: **31 Oktober 2024**
3. **Verifikasi**: 
   - Semua orders di Oktober 2024 muncul
   - Tidak ada orders dari September atau November
   - Orders tanggal 1 Oktober jam 00:00 WIB termasuk
   - Orders tanggal 31 Oktober jam 23:59 WIB termasuk

### Test Case 3: Reports Sales dengan Date Filter
1. Buka Reports page
2. Set periode:
   - From: **20 Oktober 2024**
   - To: **27 Oktober 2024**
3. **Verifikasi**:
   - Sales dari 20-27 Oktober muncul
   - Sales tanggal 19 Oktober tidak muncul
   - Sales tanggal 28 Oktober tidak muncul

### Test Case 4: Cek Consistency Across Pages
1. Create order tanggal **25 Oktober 2024** jam **14:30**
2. Cek di berbagai halaman:
   - ✅ Orders page: tanggal **25 Oktober 2024**
   - ✅ Reports Sales: counted di **25 Oktober 2024**
   - ✅ Menu Items Report: counted di **25 Oktober 2024**
   - ✅ Database: `2024-10-25T07:30:00.000Z` (25 Oct 14:30 Jakarta - 7 jam = 07:30 UTC)

## Penjelasan Technical

### Mengapa Simpan di UTC?
- **Best Practice**: Database pakai UTC untuk consistency
- **Multi-Timezone Support**: Kalau nanti ada user dari timezone lain, tinggal adjust display
- **No DST Issues**: UTC tidak ada daylight saving time

### Mengapa Kurangi 7 Jam?
- Asia/Jakarta = UTC+7
- Untuk convert Jakarta ke UTC: **Jakarta Time - 7 hours = UTC**
- Contoh: 27 Oct 10:00 Jakarta - 7 jam = 27 Oct 03:00 UTC

### Mengapa Frontend yang Handle?
- **Centralized Logic**: Semua conversion di satu tempat (`timezone.ts`)
- **Consistent**: Frontend tahu local timezone user
- **Simple Backend**: Backend tidak perlu tahu timezone, terima UTC saja

## Common Pitfalls (Sudah Dihindari)

❌ **SALAH:**
```typescript
// Adjust di frontend DAN backend (double adjust!)
// Frontend: subtract 7 hours
// Backend: setHours(0,0,0,0) → adjust lagi!
// Result: Tanggal jadi berantakan
```

✅ **BENAR:**
```typescript
// Frontend: Convert Jakarta → UTC
const utcDate = toUTCForJakarta(localDate);

// Backend: Langsung pakai UTC
where.orderDate.gte = new Date(from);
```

## Files Modified

### New Files:
1. `src/lib/timezone.ts` - Timezone utility functions

### Modified Files:
1. `src/app/orders/page.tsx` - Add timezone imports and conversions
2. `src/app/reports/page.tsx` - Add timezone conversions for filters
3. `src/app/sales/page.tsx` - Add timezone conversions for filters
4. `src/app/api/orders/route.ts` - Remove double adjustment
5. `src/app/api/reports/sales/route.ts` - Remove double adjustment
6. `src/app/api/reports/menu-items/route.ts` - Remove double adjustment
7. `src/app/api/sales/route.ts` - Remove double adjustment

## Verification Checklist

- ✅ Create order dengan tanggal X → DB simpan UTC yang benar
- ✅ Display order date tetap tampil sebagai tanggal yang dipilih user
- ✅ Filter by date range berfungsi dengan benar
- ✅ Reports sales dengan date filter akurat
- ✅ Menu items report dengan date filter akurat
- ✅ Tidak ada tanggal yang "bergeser" 1 hari
- ✅ Jam di database bukan lagi selalu 17:00:00
- ✅ Konsisten di semua halaman (Orders, Sales, Reports)

## Migration Notes

**Tidak perlu migration data!**

Alasan:
- Data lama yang sudah tersimpan sebagai UTC tetap valid
- Yang penting adalah display dan filter yang benar
- Timezone utility akan handle baik data lama maupun baru dengan cara yang sama

## Future Improvements

Jika nanti aplikasi perlu support multi-timezone:
1. Simpan user timezone preference di database
2. Update `timezone.ts` untuk terima timezone parameter
3. Display date sesuai user timezone masing-masing
4. API response include timezone info

Tapi untuk sekarang (single timezone: Asia/Jakarta), implementasi ini sudah cukup.

