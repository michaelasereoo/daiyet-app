# Availability System - Code Overview

This document outlines how the availability system works: displaying schedules, setting available slots, and real-time fetching.

---

## 📋 Table of Contents

1. [Displaying Schedules](#displaying-schedules)
2. [Setting Available Slots](#setting-available-slots)
3. [Real-Time Fetching](#real-time-fetching)
4. [API Routes](#api-routes)
5. [Data Flow Diagram](#data-flow-diagram)

---

## 1. Displaying Schedules

### Main Availability Page (`app/dashboard/availability/page.tsx`)

**Purpose**: Lists all availability schedules for a dietitian

**Key Features**:
- Fetches schedules on mount with caching
- Displays schedule name, default status, timezone, and slots
- Toggle to enable/disable all availability
- Navigation to individual schedule editor

**Real-time Updates**:
```typescript
// Lines 35-123: Fetch with localStorage caching
useEffect(() => {
  // 1. Load from cache first (instant display)
  const cachedSchedules = localStorage.getItem("availability_schedules");
  if (cachedSchedules && Date.now() - parsed.timestamp < 300000) {
    setSchedules(parsed.data);
  }
  
  // 2. Fetch fresh data from API
  const schedulesResponse = await fetch("/api/availability", {
    credentials: "include",
  });
  
  // 3. Cache the result
  localStorage.setItem("availability_schedules", JSON.stringify({
    data: schedules,
    timestamp: Date.now()
  }));
}, []);
```

**Display Logic**:
```typescript
// Lines 311-354: Render schedule cards
schedules.map((schedule) => (
  <div onClick={() => router.push(`/dashboard/availability/${schedule.id}`)}>
    <h3>{schedule.name}</h3>
    {schedule.isDefault && <span>Default</span>}
    {schedule.slots.map((slot) => (
      <div>{slot.day}, {slot.start} - {slot.end}</div>
    ))}
  </div>
))
```

---

### Schedule Detail Page (`app/dashboard/availability/[id]/page.tsx`)

**Purpose**: Edit individual schedule with day-by-day time slots

**Key Features**:
- Toggle days on/off
- Add/remove time slots per day
- Copy times from one day to others
- Save/delete schedule

**State Management**:
```typescript
// Lines 40-48: Component state
const [schedule, setSchedule] = useState<Schedule | null>(null);
const [scheduleName, setScheduleName] = useState("");

// Lines 112-136: Toggle day on/off
const toggleDay = (day: string) => {
  setSchedule((prev) => ({
    ...prev,
    days: {
      ...prev.days,
      [day]: {
        ...prev.days[day],
        enabled: !isCurrentlyEnabled,
        slots: !isCurrentlyEnabled && dayData.slots.length === 0
          ? [{ start: "9:00am", end: "5:00pm" }] // Default slot
          : dayData.slots,
      },
    },
  }));
};

// Lines 138-163: Add time slot
const addTimeSlot = (day: string) => {
  const currentSlots = prev.days[day]?.slots || [];
  const lastSlot = currentSlots[currentSlots.length - 1];
  const newStart = lastSlot ? lastSlot.end : "9:00am";
  
  setSchedule((prev) => ({
    ...prev,
    days: {
      ...prev.days,
      [day]: {
        ...prev.days[day],
        slots: [...currentSlots, { start: newStart, end: newEnd }],
      },
    },
  }));
};
```

**Save Logic**:
```typescript
// Lines 247-289: Save schedule to API
const handleSave = async () => {
  const response = await fetch(`/api/availability/${scheduleId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: scheduleName,
      timezone: schedule.timezone,
      days: schedule.days,
      isDefault: schedule.isDefault,
    }),
  });
  
  // Show success modal and navigate back
  setShowSuccessModal(true);
  setTimeout(() => router.push("/dashboard/availability"), 2000);
};
```

---

## 2. Setting Available Slots

### Creating a New Schedule

**Flow**:
1. User clicks "New" button → Opens `AddScheduleModal`
2. User enters schedule name
3. Creates schedule via POST `/api/availability`
4. Navigates to detail page to configure slots

**API Route** (`app/api/availability/route.ts` - POST):
```typescript
// Lines 87-225: Create schedule
export async function POST(request: NextRequest) {
  const { name, timezone, slots, isDefault } = await request.json();
  
  // 1. Unset other defaults if this is default
  if (isDefault) {
    await supabaseAdmin
      .from("availability_schedules")
      .update({ is_default: false })
      .eq("dietitian_id", dietitianId)
      .eq("is_default", true);
  }
  
  // 2. Create schedule
  const { data: schedule } = await supabaseAdmin
    .from("availability_schedules")
    .insert({
      dietitian_id: dietitianId,
      name,
      is_default: isDefault || false,
      timezone: timezone || "Africa/Lagos",
    })
    .select()
    .single();
  
  // 3. Create slots if provided
  if (slots && slots.length > 0) {
    const slotRecords = slots.map((slot) => ({
      schedule_id: schedule.id,
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
      enabled: true,
    }));
    
    await supabaseAdmin
      .from("availability_schedule_slots")
      .insert(slotRecords);
  }
  
  return NextResponse.json({ schedule }, { status: 201 });
}
```

### Updating Schedule Slots

**API Route** (`app/api/availability/[id]/route.ts` - PUT):
```typescript
// Lines 118-322: Update schedule
export async function PUT(request: NextRequest, { params }) {
  const { name, timezone, days, isDefault } = await request.json();
  
  // 1. Update schedule metadata
  await supabaseAdmin
    .from("availability_schedules")
    .update({ name, timezone, is_default: isDefault })
    .eq("id", scheduleId);
  
  // 2. Delete existing slots
  await supabaseAdmin
    .from("availability_schedule_slots")
    .delete()
    .eq("schedule_id", scheduleId);
  
  // 3. Create new slots from days object
  const dayNames = ["Sunday", "Monday", ..., "Saturday"];
  dayNames.forEach((dayName, dayIndex) => {
    const dayData = days[dayName];
    if (dayData && dayData.enabled && dayData.slots.length > 0) {
      dayData.slots.forEach((slot) => {
        slotRecords.push({
          schedule_id: scheduleId,
          day_of_week: dayIndex,
          start_time: slot.startTime || slot.start,
          end_time: slot.endTime || slot.end,
          enabled: true,
        });
      });
    }
  });
  
  // 4. Insert new slots
  await supabaseAdmin
    .from("availability_schedule_slots")
    .insert(slotRecords);
}
```

---

## 3. Real-Time Fetching

### For Users Booking Appointments

**Component**: `components/booking/time-slot-picker.tsx`

**Purpose**: Fetches and displays available time slots for a specific date

**Real-Time Fetching**:
```typescript
// Lines 46-81: Fetch availability when date changes
useEffect(() => {
  if (dietitianId && date) {
    const fetchAvailability = async () => {
      setLoadingSlots(true);
      const dateStr = dayjs(date).format("YYYY-MM-DD");
      const nextDayStr = dayjs(date).add(1, "day").format("YYYY-MM-DD");
      
      const response = await fetch(
        `/api/availability/timeslots?dietitianId=${dietitianId}&startDate=${dateStr}&endDate=${nextDayStr}&duration=${duration}`,
        { credentials: "include" }
      );
      
      if (response.ok) {
        const data = await response.json();
        // Convert ISO datetime slots to HH:mm format
        const formattedSlots = (data.slots || [])
          .filter((slot) => dayjs(slot.start).isSame(dayjs(date), "day"))
          .map((slot) => dayjs(slot.start).format("HH:mm"));
        setRealAvailableSlots(formattedSlots);
      }
    };
    
    fetchAvailability();
  }
}, [dietitianId, date, duration]); // Re-fetches when date changes
```

### Optimized Hook for Real-Time Updates

**Hook**: `hooks/useOptimizedAvailability.ts`

**Features**:
- Smart polling with exponential backoff
- Tab visibility detection (pauses when tab is hidden)
- localStorage caching for offline support
- Error handling with retry logic

**Implementation**:
```typescript
// Lines 132-153: Smart polling setup
useEffect(() => {
  if (!enabled || !dietitianId || !isTabVisibleRef.current) return;
  
  const poll = () => {
    if (isTabVisibleRef.current) {
      fetchAvailability();
    }
    
    // Schedule next poll with dynamic interval
    clearTimeout(pollIntervalRef.current);
    pollIntervalRef.current = setTimeout(poll, getNextPollInterval());
  };
  
  // Initial fetch
  fetchAvailability();
  pollIntervalRef.current = setTimeout(poll, getNextPollInterval());
  
  return () => clearTimeout(pollIntervalRef.current);
}, [dietitianId, eventTypeId, startDate, endDate, enabled]);
```

**Polling Strategy**:
```typescript
// Lines 33-42: Exponential backoff with jitter
const getNextPollInterval = () => {
  const baseInterval = 30000; // 30 seconds base
  const maxInterval = 300000; // 5 minutes max
  const backoffFactor = Math.min(consecutiveErrorsRef.current, 5);
  
  const interval = baseInterval * Math.pow(2, backoffFactor);
  const jitter = Math.random() * 0.3 * interval; // ±30% jitter
  
  return Math.min(interval + jitter, maxInterval);
};
```

---

## 4. API Routes

### GET `/api/availability` - List All Schedules

**File**: `app/api/availability/route.ts` (Lines 6-84)

**Returns**: Array of schedules with their slots

**Response Format**:
```json
{
  "schedules": [
    {
      "id": "uuid",
      "name": "Working Hours",
      "isDefault": true,
      "timezone": "Africa/Lagos",
      "slots": [
        {
          "day": "Monday",
          "dayOfWeek": 1,
          "start": "9:00 AM",
          "end": "5:00 PM",
          "startTime": "09:00:00",
          "endTime": "17:00:00"
        }
      ]
    }
  ]
}
```

### GET `/api/availability/[id]` - Get Single Schedule

**File**: `app/api/availability/[id]/route.ts` (Lines 6-116)

**Returns**: Single schedule with days organized by day name

**Response Format**:
```json
{
  "schedule": {
    "id": "uuid",
    "name": "Working Hours",
    "isDefault": true,
    "timezone": "Africa/Lagos",
    "days": {
      "Monday": {
        "enabled": true,
        "slots": [
          { "start": "9:00 AM", "end": "5:00 PM" }
        ]
      }
    }
  }
}
```

### GET `/api/availability/timeslots` - Calculate Available Slots

**File**: `app/api/availability/timeslots/route.ts` (Lines 12-336)

**Purpose**: Calculates actual available time slots for a date range, considering:
- Base availability schedule
- Existing bookings
- Out-of-office periods
- Date overrides

**Query Parameters**:
- `dietitianId`: ID of the dietitian
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `duration`: Duration in minutes (default: 30)
- `eventTypeId`: Optional event type ID (uses specific schedule if set)

**Response Format**:
```json
{
  "slots": [
    {
      "start": "2024-01-15T09:00:00.000Z",
      "end": "2024-01-15T09:30:00.000Z",
      "available": true
    }
  ],
  "timezone": "Africa/Lagos",
  "scheduleId": "uuid"
}
```

**Calculation Logic**:
```typescript
// Lines 297-310: Calculate slots with all constraints
const availableSlots = calculateSlotsForDateRange(
  startDate,
  endDate,
  availabilitySlots, // From schedule
  bookings, // Existing bookings
  durationMinutes,
  timezone,
  formattedOOOPeriods, // Out-of-office
  formattedOverrides // Date overrides
);
```

**Calculation Library**: `lib/availability/calculate-timeslots.ts`

**Key Functions**:
- `calculateSlotsForDateRange()`: Main function that considers all constraints
- `calculateAvailableSlots()`: Generates slots for a single date
- `checkOutOfOffice()`: Checks if date is in OOO period
- `getDateOverride()`: Gets override for a specific date

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DIETITIAN SETS AVAILABILITY               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  /dashboard/availability/page.tsx     │
        │  - Lists all schedules               │
        │  - Toggle all availability          │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  /dashboard/availability/[id]/page   │
        │  - Edit schedule                     │
        │  - Toggle days                      │
        │  - Add/remove time slots            │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  PUT /api/availability/[id]         │
        │  - Updates schedule in DB            │
        │  - Deletes old slots                │
        │  - Inserts new slots                │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Supabase Database                   │
        │  - availability_schedules            │
        │  - availability_schedule_slots        │
        └─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    USER BOOKS APPOINTMENT                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  TimeSlotPicker Component           │
        │  - Fetches on date change           │
        │  - Shows available slots            │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  GET /api/availability/timeslots    │
        │  - Fetches schedule                 │
        │  - Fetches bookings                 │
        │  - Fetches OOO periods               │
        │  - Fetches date overrides            │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  calculateSlotsForDateRange()        │
        │  - Generates slots from schedule     │
        │  - Excludes booked times             │
        │  - Applies OOO periods               │
        │  - Applies date overrides            │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Returns available slots             │
        │  [{ start, end, available }]         │
        └─────────────────────────────────────┘
```

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `app/dashboard/availability/page.tsx` | List all schedules |
| `app/dashboard/availability/[id]/page.tsx` | Edit individual schedule |
| `components/booking/time-slot-picker.tsx` | Display available slots for booking |
| `app/api/availability/route.ts` | List/create schedules |
| `app/api/availability/[id]/route.ts` | Get/update/delete schedule |
| `app/api/availability/timeslots/route.ts` | Calculate available slots |
| `lib/availability/calculate-timeslots.ts` | Slot calculation logic |
| `hooks/useOptimizedAvailability.ts` | Real-time polling hook |

---

## Real-Time Update Mechanisms

1. **On-Demand Fetching**: Components fetch when needed (date change, mount)
2. **Polling**: `useOptimizedAvailability` hook polls every 30s-5min
3. **Caching**: localStorage caches data for instant display
4. **Tab Visibility**: Polling pauses when tab is hidden
5. **Error Handling**: Exponential backoff on errors

---

## Notes for Senior Developer

1. **No WebSocket/SSE**: Currently uses polling, not real-time subscriptions
2. **Caching Strategy**: localStorage used for instant UI updates, refreshed from API
3. **Calculation Complexity**: Slot calculation happens server-side to handle timezones, bookings, OOO, and overrides
4. **Schedule Hierarchy**: Event types can have specific schedules, otherwise uses default schedule
5. **Active Flag**: Schedules have an `active` flag - if all are inactive, no slots are returned

