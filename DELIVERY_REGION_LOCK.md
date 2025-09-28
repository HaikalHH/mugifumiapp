# Delivery Region Filter Lock

## Summary
Updated the delivery page to lock the region filter based on user role. Jakarta and Bandung users can only see their respective regions, while Admin and Manager can see all regions.

## Changes Made

### 1. Added Region Lock Logic (`src/app/delivery/page.tsx`)

#### **Added State Variables:**
```typescript
// Lock region filter based on user role
const getInitialRegion = () => {
  if (username === "Admin" || username === "Manager") {
    return "all"; // Admin and Manager can see all regions
  } else if (username === "Jakarta") {
    return "Jakarta"; // Jakarta user locked to Jakarta
  } else if (username === "Bandung") {
    return "Bandung"; // Bandung user locked to Bandung
  }
  return "all"; // Default fallback
};

const [lockedRegion, setLockedRegion] = useState(getInitialRegion());
```

#### **Added useEffect for Region Lock:**
```typescript
// Lock region filter based on user role
useEffect(() => {
  const initialRegion = getInitialRegion();
  setLockedRegion(initialRegion);
  setRegionFilter(initialRegion);
}, [username]);
```

#### **Updated UI with Conditional Rendering:**
```typescript
{(username === "Admin" || username === "Manager") ? (
  <Select value={regionFilter} onValueChange={setRegionFilter}>
    <SelectTrigger className="w-[200px]">
      <SelectValue placeholder="All Regions" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Regions</SelectItem>
      <SelectItem value="Bandung">Bandung</SelectItem>
      <SelectItem value="Jakarta">Jakarta</SelectItem>
    </SelectContent>
  </Select>
) : (
  <div className="w-[200px] border rounded-md p-2 bg-gray-50 text-gray-600">
    {lockedRegion === "all" ? "All Regions" : lockedRegion}
  </div>
)}
```

## User Access Control

### **Admin & Manager:**
- ✅ Can select any region (All Regions, Bandung, Jakarta)
- ✅ Full access to all delivery data
- ✅ Can switch between regions freely

### **Jakarta User:**
- ❌ Cannot change region filter
- ✅ Automatically locked to "Jakarta"
- ✅ Can only see Jakarta deliveries
- ✅ Filter shows "Jakarta" in disabled state

### **Bandung User:**
- ❌ Cannot change region filter
- ✅ Automatically locked to "Bandung"
- ✅ Can only see Bandung deliveries
- ✅ Filter shows "Bandung" in disabled state

## Visual Behavior

### **Admin/Manager View:**
```
┌─────────────────┐
│ Filter by Region│
│ [All Regions ▼] │ ← Dropdown selectable
└─────────────────┘
```

### **Jakarta/Bandung User View:**
```
┌─────────────────┐
│ Filter by Region│
│ [Jakarta      ] │ ← Disabled, gray background
└─────────────────┘
```

## Implementation Details

### **Region Lock Logic:**
1. **Initialization**: `getInitialRegion()` determines locked region based on username
2. **State Management**: `lockedRegion` stores the locked region value
3. **Filter Setting**: `regionFilter` is automatically set to locked region
4. **UI Rendering**: Conditional rendering based on user role

### **Data Filtering:**
- **API Calls**: Both `loadDeliveries()` and `loadPendingOrders()` use `regionFilter`
- **Automatic Filtering**: Data is automatically filtered by locked region
- **No Override**: Users cannot change the region filter

### **Security:**
- **Client-Side Lock**: UI prevents region filter changes
- **Server-Side Validation**: API endpoints should validate user permissions
- **Consistent Behavior**: Same logic applied to both pending orders and delivery history

## Benefits

1. **Data Security**: Users can only see their assigned region data
2. **User Experience**: Clear indication of locked region
3. **Administrative Control**: Admin/Manager maintain full access
4. **Consistent Interface**: Same UI pattern across all users
5. **Automatic Filtering**: No manual region selection needed for locked users

## Test Scenarios

### **Scenario 1: Admin User**
1. Login as Admin
2. Navigate to Delivery page
3. ✅ Region filter shows dropdown with all options
4. ✅ Can select "All Regions", "Bandung", or "Jakarta"
5. ✅ Data updates based on selection

### **Scenario 2: Jakarta User**
1. Login as Jakarta user
2. Navigate to Delivery page
3. ✅ Region filter shows "Jakarta" in disabled state
4. ✅ Cannot click or change the filter
5. ✅ Only Jakarta deliveries are shown

### **Scenario 3: Bandung User**
1. Login as Bandung user
2. Navigate to Delivery page
3. ✅ Region filter shows "Bandung" in disabled state
4. ✅ Cannot click or change the filter
5. ✅ Only Bandung deliveries are shown

### **Scenario 4: Manager User**
1. Login as Manager
2. Navigate to Delivery page
3. ✅ Region filter shows dropdown with all options
4. ✅ Can select any region
5. ✅ Full access like Admin

## Files Modified
- ✅ `src/app/delivery/page.tsx` - Added region lock logic and UI

## Notes
- Region lock is applied immediately on page load
- No manual region selection needed for locked users
- Admin and Manager maintain full administrative access
- Consistent with existing user role patterns in the application
