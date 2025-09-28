# Reports Menu Items Update - Use Orders Instead of Sales

## Summary
Updated the menu items report API to fetch data from the `Order` and `OrderItem` tables instead of the `Sale` and `SaleItem` tables, while maintaining the same column structure and functionality.

## Changes Made

### API Endpoint Update
**File**: `src/app/api/reports/menu-items/route.ts`

#### Before (Using Sale/SaleItem tables):
```typescript
// Build sale filter
const whereSale: any = {};
if (location) whereSale.location = location;
if (outlet) whereSale.outlet = outlet;
if (from || to) {
  whereSale.orderDate = {};
  if (from) whereSale.orderDate.gte = new Date(from);
  if (to) whereSale.orderDate.lte = new Date(to);
}

// Get sale items
const saleItems = await prisma.saleItem.findMany({
  where: { sale: whereSale },
  select: {
    id: true,
    barcode: true,
    price: true,
    status: true,
    productId: true,
    saleId: true,
  }
});

// Get sales data
const sales = await prisma.sale.findMany({
  where: { id: { in: saleIds } },
  select: {
    id: true,
    outlet: true,
    location: true,
    orderDate: true,
  }
});
```

#### After (Using Order/OrderItem tables):
```typescript
// Build order filter
const whereOrder: any = {};
if (location) whereOrder.location = location;
if (outlet) whereOrder.outlet = outlet;
if (from || to) {
  whereOrder.orderDate = {};
  if (from) whereOrder.orderDate.gte = new Date(from);
  if (to) whereOrder.orderDate.lte = new Date(to);
}

// Get order items
const orderItems = await prisma.orderItem.findMany({
  where: { order: whereOrder },
  select: {
    id: true,
    productId: true,
    quantity: true,
    price: true,
    orderId: true,
  }
});

// Get orders data
const orders = await prisma.order.findMany({
  where: { id: { in: orderIds } },
  select: {
    id: true,
    outlet: true,
    location: true,
    orderDate: true,
  }
});
```

### Data Processing Logic Update

#### Before (SaleItem-based calculation):
```typescript
for (const item of saleItems) {
  const product = productMap.get(item.productId);
  const sale = saleMap.get(item.saleId);
  
  menuItem.totalQuantity += 1; // Each saleItem = 1 unit
  menuItem.totalRevenue += item.price; // Direct price
  menuItem.totalHppValue += Math.round(item.price * product.hppPct);
  
  menuItem.sales.push({
    barcode: item.barcode,
    price: item.price,
    outlet: sale.outlet,
    location: sale.location,
    orderDate: sale.orderDate,
    status: item.status,
  });
}
```

#### After (OrderItem-based calculation):
```typescript
for (const item of orderItems) {
  const product = productMap.get(item.productId);
  const order = orderMap.get(item.orderId);
  
  menuItem.totalQuantity += item.quantity; // Use actual quantity
  menuItem.totalRevenue += (item.price * item.quantity); // price * quantity
  menuItem.totalHppValue += Math.round((item.price * item.quantity) * product.hppPct);
  
  menuItem.sales.push({
    quantity: item.quantity,
    price: item.price,
    outlet: order.outlet,
    location: order.location,
    orderDate: order.orderDate,
    orderId: order.id,
  });
}
```

## Key Differences

### 1. **Quantity Handling**
- **Before**: Each `saleItem` represented 1 unit (no quantity field)
- **After**: Each `orderItem` has a `quantity` field for multiple units

### 2. **Revenue Calculation**
- **Before**: `totalRevenue += item.price` (single unit price)
- **After**: `totalRevenue += (item.price * item.quantity)` (price × quantity)

### 3. **Data Structure**
- **Before**: Used `barcode` and `status` from `saleItem`
- **After**: Uses `quantity` and `orderId` from `orderItem`

### 4. **Table Relations**
- **Before**: `saleItem` → `sale` (many-to-one)
- **After**: `orderItem` → `order` (many-to-one)

## Maintained Functionality

### ✅ **Same Response Structure**
```typescript
{
  menuItems: [
    {
      productCode: "P001",
      productName: "Product Name",
      productPrice: 10000,
      hppPct: 0.6,
      totalQuantity: 50, // Now includes quantity from orders
      totalRevenue: 500000, // Now calculated as price × quantity
      totalHppValue: 300000,
      totalProfit: 200000,
      averagePrice: 10000,
      outlets: ["Tokopedia", "Shopee"],
      locations: ["Jakarta", "Bandung"],
      sales: [
        {
          quantity: 5, // New field
          price: 10000,
          outlet: "Tokopedia",
          location: "Jakarta",
          orderDate: "2024-01-01T00:00:00.000Z",
          orderId: 123, // New field (replaces barcode/status)
        }
      ]
    }
  ],
  totals: {
    totalItems: 100,
    totalRevenue: 1000000,
    totalHppValue: 600000,
    totalProfit: 400000,
    uniqueProducts: 10,
  }
}
```

### ✅ **Same Filtering Options**
- Date range filtering (`from`, `to`)
- Location filtering
- Outlet filtering
- All filters work with Order table structure

### ✅ **Same Calculations**
- Total quantity (now includes order quantities)
- Total revenue (now price × quantity)
- Total HPP value (now based on quantity)
- Total profit calculation
- Average price calculation

## Benefits

1. **Accurate Quantity Tracking**: Now reflects actual quantities ordered
2. **Better Revenue Calculation**: Properly calculates revenue based on quantity
3. **Consistent Data Source**: Uses the same Order table as other reports
4. **Future-Proof**: Aligned with the new Order/Delivery workflow
5. **Maintained Compatibility**: Frontend reports page works without changes

## Files Modified
- ✅ `src/app/api/reports/menu-items/route.ts` - Updated to use Order/OrderItem tables

## Database Requirements
- ✅ `Order` table must exist
- ✅ `OrderItem` table must exist
- ✅ Proper foreign key relationships between Order and OrderItem

## Test Scenarios

### Scenario 1: Single Product, Multiple Quantities
1. Create order with Product A, quantity 5
2. Create another order with Product A, quantity 3
3. View menu items report
4. ✅ Product A shows totalQuantity: 8, totalRevenue: (price × 8)

### Scenario 2: Multiple Products
1. Create orders with different products and quantities
2. View menu items report
3. ✅ Each product shows correct total quantities and revenues
4. ✅ Totals section shows aggregated values

### Scenario 3: Filtering
1. Create orders for different outlets/locations/dates
2. Apply filters in reports
3. ✅ Only matching orders are included in calculations

## Notes
- The frontend reports page requires no changes
- All existing filtering and display functionality is preserved
- The report now accurately reflects the Order/Delivery workflow
- Quantity-based calculations provide more accurate business insights
