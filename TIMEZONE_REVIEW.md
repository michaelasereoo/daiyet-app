# Timezone Review - Lagos (Africa/Lagos) Implementation

## ✅ What's Currently Working

### 1. **UI Display**
- ✅ Availability pages show "Africa/Lagos" timezone
- ✅ Settings page defaults to "Africa/Lagos"
- ✅ Booking pages display "Africa/Lagos" timezone indicator
- ✅ Mock availability schedules use "Africa/Lagos"

### 2. **Google Calendar Integration**
- ✅ `lib/google-calendar.ts` correctly uses `timeZone: "Africa/Lagos"` when creating calendar events
- ✅ Both `start` and `end` times are set with Lagos timezone

### 3. **Database Schema**
- ✅ Bookings table uses `TIMESTAMPTZ` (timestamp with timezone) which properly stores timezone-aware dates

## ⚠️ Potential Issues Found

### 1. **Date Creation in Booking Flow**
**Location:** `app/user-dashboard/book-a-call/page.tsx` (line 294)

**Current Code:**
```javascript
startTime: new Date(`${dayjs(selectedDate).format("YYYY-MM-DD")}T${selectedTime}`).toISOString(),
```

**Problem:**
- Creates a date string without timezone information (e.g., `"2024-01-15T14:00"`)
- `new Date()` interprets this in the **browser's local timezone**, not Lagos
- If a user in a different timezone books, the time will be incorrect

**Example Issue:**
- User in New York (EST, UTC-5) selects "2:00 PM" Lagos time
- Code creates: `new Date("2024-01-15T14:00")` 
- Browser interprets as 2:00 PM EST (not Lagos time)
- Converts to UTC: 7:00 PM UTC
- But it should be 1:00 PM UTC (2:00 PM Lagos = UTC+1)

### 2. **Missing Timezone Plugin**
- `dayjs` is installed but timezone plugin is not configured
- No explicit timezone handling in date operations

## 🔧 Recommendations

### Option 1: Install and Use dayjs Timezone Plugin (Recommended)

1. **Install timezone plugin:**
```bash
npm install dayjs
```

2. **Create a timezone utility file:**
```typescript
// lib/timezone.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const LAGOS_TIMEZONE = "Africa/Lagos";

export function toLagosTime(date: Date | string, time: string): string {
  // Parse date and time, assume they're in Lagos timezone
  const dateStr = typeof date === 'string' ? date : dayjs(date).format("YYYY-MM-DD");
  const lagosDateTime = dayjs.tz(`${dateStr}T${time}`, LAGOS_TIMEZONE);
  return lagosDateTime.toISOString();
}

export function formatInLagos(date: Date | string): string {
  return dayjs(date).tz(LAGOS_TIMEZONE).format();
}
```

3. **Update booking creation:**
```typescript
import { toLagosTime } from "@/lib/timezone";

startTime: toLagosTime(selectedDate, selectedTime),
endTime: toLagosTime(selectedDate, calculateEndTime(selectedTime, duration)),
```

### Option 2: Use Native Date with Explicit Timezone

```typescript
// Create date in Lagos timezone explicitly
const lagosDate = new Date(`${dayjs(selectedDate).format("YYYY-MM-DD")}T${selectedTime}:00+01:00`);
// Or use Intl.DateTimeFormat to handle timezone conversion
```

### Option 3: Server-Side Timezone Conversion

Move timezone handling to the API route:
```typescript
// In API route
import { zonedTimeToUtc } from 'date-fns-tz';

const startTimeUTC = zonedTimeToUtc(
  `${date}T${time}`,
  'Africa/Lagos'
).toISOString();
```

## 📋 Testing Checklist

To verify timezone handling works correctly:

1. **Test from different timezones:**
   - Change browser/system timezone to different zones
   - Create a booking for "2:00 PM"
   - Verify it's stored correctly in database (should be 1:00 PM UTC for Lagos 2:00 PM)

2. **Verify Google Calendar:**
   - Check that calendar events show correct time in Lagos
   - Verify Meet links are scheduled for correct time

3. **Check database storage:**
   - Verify `start_time` and `end_time` in bookings table are correct UTC times
   - Query should show times that convert correctly to Lagos time

4. **Test availability display:**
   - Verify time slots are shown in Lagos time
   - Check that "past" slots are correctly identified

## 🎯 Priority Actions

1. **HIGH:** Fix date creation in booking flow to use Lagos timezone
2. **MEDIUM:** Add timezone utility functions for consistent handling
3. **LOW:** Add timezone display/selection in booking UI (if needed for international users)

## 📝 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| UI Display | ✅ Good | Shows "Africa/Lagos" correctly |
| Google Calendar | ✅ Good | Uses Lagos timezone correctly |
| Database Schema | ✅ Good | TIMESTAMPTZ handles timezones |
| Booking Creation | ⚠️ Needs Fix | Uses browser timezone instead of Lagos |
| Availability Schedules | ✅ Good | Mock data uses Lagos (needs API implementation) |

## 🔍 Files to Review/Update

1. `app/user-dashboard/book-a-call/page.tsx` - Fix date creation (line 294)
2. `app/book/[dietitian]/page.tsx` - Check date creation (if used)
3. `lib/timezone.ts` - Create utility file (new)
4. `app/api/bookings/route.ts` - Verify timezone handling in API
