# Order & Delivery Updates

## Summary of Changes

### 1. Order Page Updates

#### Customer Labels by Outlet:
- **Tokopedia/Shopee**: Label changed to "ID Pesanan" 
- **WhatsApp**: Label changed to "No. HP"
- **Other outlets**: Remain as "Customer"

#### Status Management:
- Default status changed from "pending" to "confirmed"
- Status field is now read-only (non-editable)
- Removed "pending" from status options

#### Payout Fields for Tokopedia/Shopee:
- **Estimasi Total**: Auto-calculated from order items (read-only)
- **Potongan %**: Auto-calculated percentage (read-only)
- **Actual diterima**: User input for actual payout received

#### Table Actions:
- Added "Edit" action button to orders table
- Existing "View" and "Delete" (Admin only) actions remain

### 2. Delivery Page Updates

#### Filter System:
- **Replaced**: Status filter with Region filter
- **Regions**: All Regions, Bandung, Jakarta
- **Search**: Customer/ID Pesanan/No. HP search functionality
- **Access Control**: Admin can select all regions, users limited to their region

#### Pagination:
- **Pending Orders**: Limited to 10 items per page with pagination
- **Delivery History**: Limited to 10 items per page with pagination
- Both tables show proper pagination controls

#### Delivery Processing:
- Fixed barcode scanning validation
- Improved error handling for inventory lookup
- Better product matching logic

#### Admin Actions:
- **Cancel Delivery**: Admin-only action to revert delivered orders
- **Functionality**: 
  - Reverts delivery status to pending
  - Changes inventory items back to "READY" status
  - Removes delivery and delivery items
  - Updates both pending orders and delivery history

### 3. Database Schema Updates

#### Order Table:
```sql
-- New field added
ALTER TABLE "Order" ADD COLUMN "actPayout" INTEGER;

-- Status default changed
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'confirmed';

-- Status constraint updated
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_status_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" CHECK ("status" IN ('confirmed', 'cancelled'));
```

### 4. API Updates

#### Orders API:
- Added `actPayout` field support
- Default status changed to "confirmed"
- Total amount uses `actPayout` when available

#### Orders/Pending API:
- Added pagination support (page, pageSize)
- Added location filtering
- Added search functionality (customer, outlet)
- Returns structured response with pagination info

#### Deliveries API:
- Added location filtering
- Added search functionality
- Improved query structure

#### New Cancel Delivery API:
- `POST /api/deliveries/[id]/cancel`
- Admin-only functionality
- Reverts delivery and updates inventory

### 5. Files Modified

#### Frontend:
- `src/app/orders/page.tsx` - Order page updates
- `src/app/delivery/page.tsx` - Delivery page updates

#### Backend:
- `src/app/api/orders/route.ts` - Order API updates
- `src/app/api/orders/pending/route.ts` - Pending orders API
- `src/app/api/deliveries/route.ts` - Deliveries API updates
- `src/app/api/deliveries/[id]/cancel/route.ts` - New cancel API

#### Database:
- `prisma/schema.prisma` - Schema updates
- `migration_add_order_delivery.sql` - Updated migration
- `add_actpayout_field.sql` - New field migration

### 6. Migration Instructions

1. **Run the new SQL migration**:
   ```sql
   -- Execute add_actpayout_field.sql in your database SQL editor
   ```

2. **Regenerate Prisma client**:
   ```bash
   npx prisma generate
   ```

3. **Restart your development server**:
   ```bash
   npm run dev
   ```

### 7. Testing Checklist

#### Order Page:
- [ ] Customer labels change based on outlet selection
- [ ] Status is "confirmed" by default and read-only
- [ ] Payout fields appear for Tokopedia/Shopee
- [ ] Edit action button is visible in table
- [ ] Order creation works with new fields

#### Delivery Page:
- [ ] Region filter works correctly
- [ ] Search functionality works
- [ ] Both tables show 10 items per page
- [ ] Pagination controls work
- [ ] Barcode scanning works without errors
- [ ] Admin can cancel deliveries
- [ ] Cancel action reverts inventory status

#### Access Control:
- [ ] Admin can see all regions
- [ ] Users limited to their assigned region
- [ ] Cancel action only visible to Admin

### 8. Notes

- All changes maintain serverless compatibility
- Error handling improved throughout
- Database queries optimized with proper indexing
- UI/UX consistent with existing design patterns
- All new features include proper validation
