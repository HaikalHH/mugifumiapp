# Update: Cafe Actual Payout & Free Outlet Zero

## Tanggal
9 Oktober 2025

## Perubahan yang Dilakukan

### 1. Orders - Cafe Outlet Mendapat Actual Payout ✅

**File yang Diubah:**
- `src/app/orders/page.tsx`

**Perubahan:**
- Outlet **Cafe** sekarang memiliki field **Actual Payout** sama seperti Tokopedia dan Shopee
- Saat create/edit order dengan outlet Cafe, akan muncul:
  - Estimasi Total (Rp) - readonly
  - Potongan % (auto) - readonly, terhitung otomatis
  - Actual diterima (Rp) - input field untuk masukkan nilai actual payout

**Contoh:**
```typescript
// Field actual payout akan muncul untuk:
- Tokopedia ✅
- Shopee ✅
- Cafe ✅ (BARU!)
- WhatsApp ❌
- Wholesale ❌
- Free ❌
```

### 2. Orders - Badge Payment untuk Cafe ✅

**File yang Diubah:**
- `src/app/orders/page.tsx`

**Perubahan:**
- Badge "Paid/Not Paid" sekarang muncul juga untuk outlet **Cafe**
- Badge menampilkan status dan nilai actual payout:
  - **Paid - Rp xxx.xxx** (hijau) - jika sudah bayar
  - **Not Paid** (merah) - jika belum bayar

**Contoh:**
- Order Cafe dengan actPayout = 150000 → Badge hijau: "Paid - Rp 150.000"
- Order Cafe tanpa actPayout → Badge merah: "Not Paid"

### 3. Sales Report - Free Outlet di-0-kan ✅

**File yang Diubah:**
- `src/app/api/reports/sales/route.ts`

**Perubahan:**
- Outlet **Free** sekarang otomatis di-0-kan untuk nilai rupiah
- Item sold tetap dihitung (tidak diubah)
- Potongan % untuk Free = 100% (karena actual = 0)

**Logika:**
```typescript
const isFree = order.outlet.toLowerCase() === "free";

// Actual received untuk Free = 0
const actual = isFree ? 0 : (order.actPayout || order.totalAmount || null);

// Potongan untuk Free = 100% dari subtotal
const potongan = isFree
  ? preDiscountSubtotal
  : (isCafe ? ... : ...);

const potonganPct = isFree
  ? 100
  : (...);
```

**Dampak di Reports:**
- **Sales by Outlet**: Free akan menampilkan actual = Rp 0
- **Total Actual**: Free tidak menambah total revenue
- **Potongan %**: Free akan menampilkan 100%
- **Menu Items Sold**: Free tetap dihitung jumlah item yang terjual ✅

## Testing

### Test Case 1: Create Order Cafe dengan Actual Payout
1. Buka halaman Orders
2. Pilih Outlet = **Cafe**
3. Isi customer, tambah items
4. **Verifikasi**: Field "Actual diterima (Rp)" muncul
5. Masukkan nilai actual payout (misal: 100000)
6. Submit order
7. **Verifikasi**: Badge "Paid - Rp 100.000" (hijau) muncul di list

### Test Case 2: Create Order Cafe tanpa Actual Payout
1. Create order Cafe
2. Jangan isi field "Actual diterima"
3. Submit order
4. **Verifikasi**: Badge "Not Paid" (merah) muncul di list

### Test Case 3: Edit Order Cafe
1. Klik Edit pada order Cafe
2. **Verifikasi**: Field "Actual diterima (Rp)" muncul dan bisa diubah
3. Update nilai actual payout
4. Save
5. **Verifikasi**: Badge berubah sesuai nilai baru

### Test Case 4: Free Outlet di Reports
1. Create order dengan outlet **Free** (beberapa items)
2. Buka halaman Reports
3. **Verifikasi di Sales Report**:
   - Free outlet menampilkan Actual = Rp 0
   - Potongan % = 100%
   - Total Actual tidak terpengaruh oleh Free orders
4. **Verifikasi di Menu Items Sold**:
   - Items dari Free order tetap dihitung ✅
   - Quantity sold tetap muncul

## Ringkasan Perubahan

### Outlets dengan Actual Payout Field:
| Outlet | Actual Payout Field | Badge Payment |
|--------|-------------------|---------------|
| Tokopedia | ✅ | ✅ |
| Shopee | ✅ | ✅ |
| Cafe | ✅ (BARU!) | ✅ (BARU!) |
| WhatsApp | ❌ | ❌ |
| Wholesale | ❌ | ❌ |
| Free | ❌ | ❌ |

### Free Outlet Behavior:
- **Sales Report**: Actual = Rp 0, Potongan = 100%
- **Menu Items Sold**: Tetap dihitung normal ✅
- **Total Revenue**: Tidak berkontribusi (Rp 0)

## Files Modified

1. `src/app/orders/page.tsx`
   - Line 280: Added Cafe to actPayout condition (submitOrder)
   - Line 477: Added Cafe to actual payout field display
   - Line 649: Added Cafe to payment badge

2. `src/app/api/reports/sales/route.ts`
   - Line 69: Added isFree flag
   - Line 81: Set actual = 0 for Free outlet
   - Line 87-97: Updated potongan calculation for Free outlet

## Notes

- Actual payout untuk Cafe berguna untuk tracking pembayaran real yang diterima
- Free outlet tidak berkontribusi ke revenue tapi tetap tracking items sold
- Badge payment memudahkan identifikasi status pembayaran di list orders
- Report sales sudah menggunakan actual payout (bukan totalAmount) untuk semua outlet yang support actual payout

