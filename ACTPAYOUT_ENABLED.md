# ActPayout Field Enabled

## Problem
The `actPayout` field was commented out in the codebase, causing payout fields (estimate, actual, potongan) to not appear when editing Tokopedia/Shopee orders.

## Solution Applied

### 1. Frontend Changes (`src/app/orders/page.tsx`)

#### **State Management:**
```typescript
const [form, setForm] = useState({
  customer: "",
  status: "confirmed",
  orderDate: new Date(),
  discount: "",
  estPayout: "",
  actPayout: "", // ✅ Uncommented
});
```

#### **Edit Handler:**
```typescript
const handleEditOrder = async (orderId: number) => {
  const order = orders.find(o => o.id === orderId);
  if (order) {
    setForm({
      // ... other fields
      actPayout: order.actPayout?.toString() || "", // ✅ Uncommented
    });
  }
};
```

#### **Submit Logic:**
```typescript
const payload: any = {
  // ... other fields
  actPayout: ((editingOrderId ? editingOutlet : outlet) === "Tokopedia" || 
              (editingOrderId ? editingOutlet : outlet) === "Shopee") && 
              form.actPayout ? Number(form.actPayout) : null, // ✅ Uncommented
};
```

#### **UI Rendering:**
```typescript
{((editingOrderId ? editingOutlet : outlet) === "Tokopedia" || 
  (editingOrderId ? editingOutlet : outlet) === "Shopee") && (
  <>
    <div className="flex flex-col gap-1">
      <Label>Estimasi Total (Rp)</Label>
      <Input className="bg-gray-50" value={calculateTotal().toLocaleString("id-ID")} readOnly />
    </div>
    <div className="flex flex-col gap-1">
      <Label>Potongan % (auto)</Label>
      <Input className="bg-gray-50" value={/* auto calculation */} readOnly />
    </div>
    <div className="flex flex-col gap-1">
      <Label>Actual diterima (Rp)</Label>
      <Input type="number" placeholder="e.g. 100000" 
             value={form.actPayout} 
             onChange={(e) => setForm({ ...form, actPayout: e.target.value })} />
    </div>
  </>
)}
```

### 2. API Changes

#### **Orders API (`src/app/api/orders/route.ts`):**
```typescript
// GET response includes actPayout
select: {
  // ... other fields
  actPayout: true, // ✅ Uncommented
}

// POST request accepts actPayout
const { actPayout } = body; // ✅ Uncommented

// Create order with actPayout
data: {
  // ... other fields
  actPayout: actPayout || null, // ✅ Uncommented
}
```

#### **Orders [id] API (`src/app/api/orders/[id]/route.ts`):**
```typescript
// PUT request accepts actPayout
const { actPayout } = body; // ✅ Uncommented

// Update order with actPayout
data: {
  // ... other fields
  actPayout: actPayout || null, // ✅ Uncommented
}

// Response includes actPayout
select: {
  // ... other fields
  actPayout: true, // ✅ Uncommented
}
```

#### **Orders Pending API (`src/app/api/orders/pending/route.ts`):**
```typescript
select: {
  // ... other fields
  actPayout: true, // ✅ Added
}
```

#### **Reports Sales API (`src/app/api/reports/sales/route.ts`):**
```typescript
select: {
  // ... other fields
  actPayout: true, // ✅ Uncommented
}

// Use actPayout for actual received calculation
const actual = order.actPayout || order.totalAmount || null; // ✅ Updated
```

## Behavior Changes

### **Before Fix:**
- ❌ Payout fields not visible when editing Tokopedia/Shopee orders
- ❌ `actPayout` field commented out in all APIs
- ❌ Reports not using actual payout data
- ❌ Edit order doesn't show existing payout values

### **After Fix:**
- ✅ Payout fields visible when editing Tokopedia/Shopee orders
- ✅ `actPayout` field active in all APIs
- ✅ Reports use actual payout data when available
- ✅ Edit order shows existing payout values
- ✅ Auto-calculation of potongan percentage
- ✅ Proper outlet detection for payout fields

## Test Scenarios

### **Scenario 1: Create Tokopedia Order**
1. Select outlet "Tokopedia"
2. Click "Create Order"
3. ✅ Payout fields visible:
   - Estimasi Total (read-only)
   - Potongan % (auto-calculated, read-only)
   - Actual diterima (editable)

### **Scenario 2: Edit Tokopedia Order with ActPayout**
1. Create order with actPayout = 90000, totalAmount = 100000
2. Edit the order
3. ✅ Payout fields show:
   - Estimasi Total: 100,000
   - Potongan %: 10.0
   - Actual diterima: 90000

### **Scenario 3: Edit WhatsApp Order**
1. Create order with outlet "WhatsApp"
2. Edit the order
3. ✅ Payout fields not visible (correct behavior)

### **Scenario 4: Reports with ActPayout**
1. Create Tokopedia order with actPayout
2. View reports
3. ✅ Reports show actual received = actPayout value

## Database Requirements

**⚠️ Important:** The database must have the `actPayout` column in the `Order` table. If not present, run the migration:

```sql
-- Run this in Supabase SQL Editor
ALTER TABLE "Order" ADD COLUMN "actPayout" INTEGER;
```

## Files Modified
- ✅ `src/app/orders/page.tsx` - Enabled actPayout in form state and UI
- ✅ `src/app/api/orders/route.ts` - Enabled actPayout in GET/POST
- ✅ `src/app/api/orders/[id]/route.ts` - Enabled actPayout in PUT
- ✅ `src/app/api/orders/pending/route.ts` - Added actPayout to response
- ✅ `src/app/api/reports/sales/route.ts` - Enabled actPayout in reports

## Benefits
1. **Complete Payout Tracking**: Full visibility of estimate vs actual
2. **Automatic Calculations**: Potongan percentage calculated automatically
3. **Data Integrity**: Proper handling of payout data in all operations
4. **User Experience**: Clear payout information for Tokopedia/Shopee orders
5. **Reports Accuracy**: Reports reflect actual payout data when available
