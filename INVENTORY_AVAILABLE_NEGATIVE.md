# Inventory Available - Allow Negative Values

## Tanggal
9 Oktober 2025

## Perubahan

### Sebelum:
- **Available Stock** selalu minimum 0 (tidak bisa negatif)
- Kalau reserved > total, available tetap 0
- **Masalah**: Tidak terlihat kalau ada over-order (order melebihi stock)

### Sesudah:
- **Available Stock** bisa negatif ✅
- Kalau reserved > total, available akan negatif (menunjukkan kekurangan stock)
- **Warna indicator**:
  - **Hijau**: Available ≥ 0 (stock cukup)
  - **Merah**: Available < 0 (over-order, stock kurang)

## Use Case

### Contoh Skenario:
```
Product: Cheese Cake Original (CHSCORG)
Total Stock: 5
Reserved (sudah di-order): 8
Available: -3 (MERAH - kurang 3 unit!)
```

**Insight:**
- Ada 8 pesanan tapi stock cuma 5
- Kekurangan 3 unit
- Perlu produksi tambahan 3 unit untuk fulfill semua order

## Technical Changes

### 1. Backend API (`src/app/api/inventory/overview/route.ts`)

**Before:**
```typescript
byLocation[loc][key].available = Math.max(
  0,
  byLocation[loc][key].total - byLocation[loc][key].reserved
);
```

**After:**
```typescript
// Allow negative values to show over-order situations
byLocation[loc][key].available = byLocation[loc][key].total - byLocation[loc][key].reserved;
```

### 2. Frontend UI (`src/app/inventory/page.tsx`)

**Added Conditional Styling:**
```typescript
<td className={`p-2 text-right font-medium ${stockInfo.available < 0 ? 'text-red-600' : 'text-green-600'}`}>
  {stockInfo.available}
</td>
```

**Visual Indicator:**
- Available ≥ 0 → `text-green-600` (hijau)
- Available < 0 → `text-red-600` (merah)

## Display Examples

### By Location - Bandung
| Menu | Total | Reserved | Available |
|------|-------|----------|-----------|
| Cheese Cake Original (CHSCORG) | 5 | 8 | **-3** (🔴 merah) |
| Cheese Cake Chocolate (CHSCCHO) | 10 | 5 | **5** (🟢 hijau) |
| Cheese Cake Matcha (CHSCMAT) | 0 | 0 | **0** (🟢 hijau) |

### All Locations
| Menu | Total | Reserved | Available |
|------|-------|----------|-----------|
| Cheese Cake Original (CHSCORG) | 12 | 15 | **-3** (🔴 merah) |
| Cheese Cake Chocolate (CHSCCHO) | 20 | 10 | **10** (🟢 hijau) |

## Benefits

### 1. **Stock Management**
- Langsung terlihat produk mana yang over-order
- Prioritas produksi jelas (produk dengan available negatif)

### 2. **Early Warning**
- Warning visual (merah) langsung terlihat
- Bisa anticipate kekurangan stock sebelum delivery

### 3. **Accurate Planning**
- Tahu exact jumlah yang perlu diproduksi
- Available -5 = butuh produksi minimal 5 unit

### 4. **Better Decision Making**
- Bisa decide: produksi tambahan atau cancel sebagian order
- Visibility lengkap untuk inventory planning

## Testing Scenarios

### Test Case 1: Over-Order Situation
1. Create order untuk product X sebanyak 10 unit
2. Stock product X cuma 7 unit
3. Buka Inventory page
4. **Verify**: 
   - Total: 7
   - Reserved: 10
   - Available: **-3** (warna merah)

### Test Case 2: Sufficient Stock
1. Create order untuk product Y sebanyak 5 unit
2. Stock product Y ada 10 unit
3. Buka Inventory page
4. **Verify**:
   - Total: 10
   - Reserved: 5
   - Available: **5** (warna hijau)

### Test Case 3: Exact Match
1. Create order untuk product Z sebanyak 8 unit
2. Stock product Z ada 8 unit
3. Buka Inventory page
4. **Verify**:
   - Total: 8
   - Reserved: 8
   - Available: **0** (warna hijau)

### Test Case 4: Multiple Locations
1. Bandung: Total 3, Reserved 5 → Available -2 (merah)
2. Jakarta: Total 5, Reserved 2 → Available 3 (hijau)
3. All Locations: Total 8, Reserved 7 → Available 1 (hijau)

## Color Coding Guide

| Available Value | Color | Meaning | Action Needed |
|-----------------|-------|---------|---------------|
| > 0 | 🟢 Green | Stock sufficient | No action |
| = 0 | 🟢 Green | Exact match | Monitor closely |
| < 0 | 🔴 Red | Over-order! | **Produce more or adjust orders** |

## Files Modified

1. `src/app/api/inventory/overview/route.ts`
   - Removed `Math.max(0, ...)` for available calculation
   - Added comment about negative values

2. `src/app/inventory/page.tsx`
   - Added conditional className for available column
   - Red color for negative, green for positive/zero

## Notes

- **No breaking changes**: API response structure tetap sama
- **Backward compatible**: Data lama tetap bisa ditampilkan
- **Visual enhancement**: Warning lebih jelas dengan color coding
- **Business logic intact**: Calculation tetap akurat

## Future Enhancements

Potential improvements:
1. Add badge/icon untuk over-order items
2. Sort by available (showing negative values first)
3. Alert notification kalau ada available negatif
4. Export report untuk over-order situations
5. Auto-suggest production quantity based on negative available


