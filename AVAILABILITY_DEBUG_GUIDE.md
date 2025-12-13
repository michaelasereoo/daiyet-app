# Availability Debugging Guide

## ✅ What I've Added

### 1. **Comprehensive Console Logging**

All debug logs are prefixed with emojis for easy scanning:
- 🎯 API entry points
- 📋 Parameter parsing
- ✅ Success states
- ❌ Errors
- 🔍 Database queries
- 📊 Data analysis
- 🧮 Calculations
- 🕒 Time slots

### 2. **Debug Endpoint**

**URL**: `/api/debug/timeslots?dietitianId=UUID&date=2024-01-15`

This endpoint provides a complete diagnostic view:
- All schedules for the dietitian
- Default schedule details
- All slots (enabled/disabled)
- Slots for the specific date
- Bookings for that date
- OOO periods
- Date overrides
- Day of week mapping

**Usage**:
```bash
# In browser console or Postman
GET /api/debug/timeslots?dietitianId=YOUR_UUID&date=2024-01-15
```

### 3. **SQL Diagnostic Queries**

See `AVAILABILITY_DEBUG_SQL.md` for:
- 12 diagnostic SQL queries
- Fix scripts for common issues
- Day of week reference

### 4. **Enhanced Client-Side Logging**

The `TimeSlotPicker` component now logs:
- When it fetches availability
- What parameters it sends
- What response it receives
- How many slots were formatted

---

## 🔍 How to Debug

### Step 1: Check Server Logs

When you call `/api/availability/timeslots`, you'll now see:

```
🎯 [DEBUG] Timeslots API called with params: {...}
✅ [DEBUG] Dietitian authenticated: {...}
📋 [DEBUG] Parsed parameters: {...}
📊 [DEBUG] All schedules check: {...}
🔍 [DEBUG] Schedule query executed: {...}
⏰ [DEBUG] Availability slots converted: {...}
🧮 [DEBUG] About to calculate slots: {...}
✅ [DEBUG] Calculation complete: {...}
```

### Step 2: Use the Debug Endpoint

```bash
# Replace with your actual dietitian ID
curl "http://localhost:3000/api/debug/timeslots?dietitianId=YOUR_UUID&date=2024-01-15" \
  -H "Cookie: your-auth-cookie"
```

This will show you:
- If schedules exist
- If they're active
- If they have slots
- If slots are enabled
- Day of week mapping

### Step 3: Check Browser Console

When a user tries to book, the `TimeSlotPicker` logs:
```
📅 [DEBUG] TimeSlotPicker fetching for: {...}
✅ [DEBUG] TimeSlotPicker received response: {...}
🕒 [DEBUG] TimeSlotPicker formatted slots: {...}
```

### Step 4: Run SQL Queries

Use the queries in `AVAILABILITY_DEBUG_SQL.md` to check:
1. Do schedules exist?
2. Are they active?
3. Do they have slots?
4. Are slots enabled?
5. What day_of_week values are stored?

---

## 🐛 Common Issues & Fixes

### Issue 1: No Schedules Found

**Symptoms**: Logs show `schedulesCount: 0`

**Fix**:
```sql
-- Check if any schedules exist
SELECT * FROM availability_schedules 
WHERE dietitian_id = 'YOUR_UUID';

-- If none exist, create one via the UI or API
```

### Issue 2: Schedule Not Active

**Symptoms**: Logs show `active: false`

**Fix**:
```sql
UPDATE availability_schedules 
SET active = true 
WHERE dietitian_id = 'YOUR_UUID' AND is_default = true;
```

### Issue 3: No Slots for Day

**Symptoms**: Logs show `todaySlotsCount: 0` but schedule exists

**Possible Causes**:
1. **Day of week mismatch**: Database stores 1-7 but code expects 0-6
2. **No slots configured**: Schedule exists but no slots added
3. **All slots disabled**: Slots exist but `enabled = false`

**Fix**:
```sql
-- Check day_of_week values
SELECT DISTINCT day_of_week FROM availability_schedule_slots;

-- If using 1-7, update to 0-6 (Sunday=0)
UPDATE availability_schedule_slots 
SET day_of_week = day_of_week - 1
WHERE day_of_week BETWEEN 1 AND 7;

-- Or add default slots
INSERT INTO availability_schedule_slots (schedule_id, day_of_week, start_time, end_time, enabled)
SELECT 
  id,
  unnest(ARRAY[1,2,3,4,5]) as day_of_week, -- Mon-Fri
  '09:00:00'::time,
  '17:00:00'::time,
  true
FROM availability_schedules 
WHERE dietitian_id = 'YOUR_UUID' AND is_default = true;
```

### Issue 4: Calculation Returns Zero Slots

**Symptoms**: API returns `slots: []` but schedule and slots exist

**Check Logs For**:
- `availabilitySlotsCount` - should be > 0
- `todaySlotsCount` in calculation logs - should match enabled slots
- Day of week matching in calculation logs

**Debug**:
```typescript
// The calculation logs will show:
📅 [DEBUG] Processing date: 2024-01-15 (Monday, dayOfWeek=1)
📊 [DEBUG] Date 2024-01-15 has 2 availability slots for Monday
❌ [DEBUG] No slots generated for 2024-01-15. Reasons:
   - Availability slots for Monday: [...]
   - Bookings on this date: 0
```

---

## 📊 What to Look For

### In Server Logs:

1. **Schedule Query**:
   ```
   schedulesCount: 1  ✅ Good
   schedulesCount: 0  ❌ Problem - no schedules
   ```

2. **Slots Conversion**:
   ```
   enabledSlots: 5  ✅ Good
   enabledSlots: 0  ❌ Problem - no enabled slots
   ```

3. **Day Matching**:
   ```
   slotsByDay: { Monday: 1, Tuesday: 1, ... }  ✅ Good
   slotsByDay: {}  ❌ Problem - no slots configured
   ```

4. **Calculation**:
   ```
   slotsCount: 16  ✅ Good (generated slots)
   slotsCount: 0   ❌ Problem - calculation failed
   ```

### In Debug Endpoint Response:

```json
{
  "hasDefaultSchedule": true,  // ✅ Must be true
  "defaultSchedule": {
    "active": true,  // ✅ Must be true
    "isDefault": true  // ✅ Must be true
  },
  "enabledSlots": 5,  // ✅ Should be > 0
  "todaySlots": 1,  // ✅ Should be > 0 for the test date
  "slotsByDay": {
    "Monday": { "enabled": 1 },  // ✅ Should have enabled slots
    "Tuesday": { "enabled": 1 }
  }
}
```

---

## 🚀 Quick Test

1. **Open browser console**
2. **Navigate to booking page**
3. **Select a date**
4. **Check console for logs**:
   ```
   📅 [DEBUG] TimeSlotPicker fetching for: {...}
   ✅ [DEBUG] TimeSlotPicker received response: {...}
   ```
5. **Check server logs** for the full pipeline
6. **Call debug endpoint** to see database state

---

## 📝 Next Steps

1. **Run the debug endpoint** and share the response
2. **Check server logs** when booking fails
3. **Run SQL queries** from `AVAILABILITY_DEBUG_SQL.md`
4. **Share the findings**:
   - What does the debug endpoint return?
   - What do the server logs show?
   - What do the SQL queries reveal?

The logs will tell us exactly where the pipeline breaks! 🔍

