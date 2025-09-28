# Order Edit Outlet Fix

## Problem
When editing an order, the outlet and location were not preserved from the original order data. For example:
- Create order with outlet "Tokopedia" 
- Edit the order
- Modal shows "WhatsApp" instead of "Tokopedia"
- Submit changes the outlet to "WhatsApp"

## Root Cause
The edit functionality was using the current selected outlet/location from the filter dropdowns instead of preserving the original order's outlet and location.

## Solution Applied

### 1. Added State Variables for Editing
```typescript
const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
const [editingOutlet, setEditingOutlet] = useState<string>("");
const [editingLocation, setEditingLocation] = useState<string>("");
```

### 2. Updated Edit Handler
```typescript
const handleEditOrder = async (orderId: number) => {
  const order = orders.find(o => o.id === orderId);
  if (order) {
    setEditingOrderId(orderId);
    setEditingOutlet(order.outlet); // Preserve original outlet
    setEditingLocation(order.location); // Preserve original location
    // ... rest of the logic
  }
};
```

### 3. Updated Submit Logic
```typescript
const payload: any = {
  outlet: editingOrderId ? editingOutlet : outlet, // Use editing outlet if editing
  location: editingOrderId ? editingLocation : location, // Use editing location if editing
  // ... rest of the payload
};
```

### 4. Updated Modal Title
```typescript
<DialogTitle>
  {editingOrderId ? `Edit Order #${editingOrderId}` : `Create Order`} - 
  {editingOrderId ? editingOutlet : outlet} ({editingOrderId ? editingLocation : location})
</DialogTitle>
```

### 5. Updated Customer Label Logic
```typescript
<Label>
  {(editingOrderId ? editingOutlet : outlet) === "Tokopedia" || 
   (editingOrderId ? editingOutlet : outlet) === "Shopee" ? "ID Pesanan *" : 
   (editingOrderId ? editingOutlet : outlet) === "WhatsApp" ? "No. HP *" : "Customer *"}
</Label>
```

### 6. Reset State on New Order
```typescript
const openModal = () => {
  setEditingOrderId(null);
  setEditingOutlet(""); // Reset editing outlet
  setEditingLocation(""); // Reset editing location
  // ... rest of the reset logic
};
```

## Files Modified
- ✅ `src/app/orders/page.tsx` - Added outlet/location preservation for editing

## Behavior Changes

### Before Fix:
- ❌ Edit order → Modal shows current filter outlet/location
- ❌ Submit → Changes outlet to current filter selection
- ❌ Inconsistent data between original and edited order

### After Fix:
- ✅ Edit order → Modal shows original order's outlet/location
- ✅ Submit → Preserves original outlet/location
- ✅ Consistent data throughout edit process
- ✅ Correct customer label based on original outlet

## Test Scenarios

### Scenario 1: Edit Tokopedia Order
1. Create order with outlet "Tokopedia"
2. Change filter to "WhatsApp"
3. Edit the Tokopedia order
4. ✅ Modal title shows "Edit Order #X - Tokopedia (Location)"
5. ✅ Customer label shows "ID Pesanan *"
6. ✅ Submit preserves "Tokopedia" outlet

### Scenario 2: Edit WhatsApp Order
1. Create order with outlet "WhatsApp"
2. Change filter to "Tokopedia"
3. Edit the WhatsApp order
4. ✅ Modal title shows "Edit Order #X - WhatsApp (Location)"
5. ✅ Customer label shows "No. HP *"
6. ✅ Submit preserves "WhatsApp" outlet

### Scenario 3: Create New Order
1. Set filter to "Tokopedia"
2. Click "Create Order"
3. ✅ Modal title shows "Create Order - Tokopedia (Location)"
4. ✅ Customer label shows "ID Pesanan *"
5. ✅ Submit uses current filter selection

## Benefits

1. **Data Integrity**: Original order data is preserved during editing
2. **User Experience**: Clear indication of what's being edited
3. **Consistency**: Modal shows correct outlet-specific labels
4. **Predictability**: Edit behavior matches user expectations
5. **No Data Loss**: Outlet and location changes are intentional only

## Notes
- The fix maintains backward compatibility
- No changes to API endpoints needed
- All existing functionality preserved
- Edit and create workflows work independently
- Filter selections only affect new order creation
