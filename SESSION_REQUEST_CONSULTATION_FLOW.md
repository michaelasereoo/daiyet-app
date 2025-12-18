# Session Request & Consultation Flow - Technical Documentation

## Overview
This document outlines the complete flow for session requests (consultations), payment approval, meeting link generation, and how it differs from meal plan implementation.

---

## 1. Session Request Creation Flow

### 1.1 Dietitian Creates Session Request
**File:** `app/api/session-request/route.ts` (POST endpoint)

```typescript
// Dietitian creates a consultation request for a client
POST /api/session-request
{
  requestType: "CONSULTATION",
  clientName: "John Doe",
  clientEmail: "john@example.com",
  eventTypeId: "uuid-of-event-type",
  message: "Optional message"
}
```

**Key Steps:**
1. Validates dietitian authentication
2. Verifies event type belongs to dietitian
3. Creates session request with status `PENDING`
4. Sends email notification to client

**Database Record:**
- Table: `session_requests`
- Status: `PENDING`
- `request_type`: `CONSULTATION`
- Links to `event_types` table via `event_type_id`

---

## 2. User Approval & Payment Flow

### 2.1 User Sees Request in Dashboard
**File:** `app/user-dashboard/page.tsx`

**Flow:**
1. User dashboard fetches pending session requests via `/api/user/session-requests`
2. Consultation requests appear in "Session Requests" section
3. User clicks "Approve" button

**Code Location:**
```typescript
// app/user-dashboard/page.tsx:200-215
const handleApprove = (request: SessionRequest) => {
  if (request.requestType === "CONSULTATION") {
    // Navigate to booking page with pre-fill
    router.push(
      `/user-dashboard/book-a-call?prefill=true&dietitianId=${request.dietitian.id}&eventTypeId=${request.eventType?.id}&requestId=${request.id}&message=${encodeURIComponent(request.message || "")}`
    );
  }
};
```

### 2.2 User Completes Booking Flow
**File:** `app/user-dashboard/book-a-call/page.tsx`

**Steps:**
1. **Step 1:** User information (pre-filled from session)
2. **Step 2:** Dietitian selection (pre-filled from request)
3. **Step 3:** Date selection (availability calendar)
4. **Step 4:** Time slot selection
5. **Step 5:** Order summary & payment

**Key Code:**
- Pre-fill detection via URL params: `?prefill=true&dietitianId=X&eventTypeId=Y&requestId=Z`
- Payment modal opens at checkout step
- On payment success, booking is created

### 2.3 Payment Processing
**File:** `app/api/payments/verify/route.ts`

**Flow After Payment:**
1. Payment verified via Paystack callback
2. Booking status updated to `CONFIRMED`
3. Meeting link generated automatically
4. Session request status updated to `APPROVED`

**Critical Code:**
```typescript
// app/api/payments/verify/route.ts:66-153
if (booking) {
  // 1. ALWAYS confirm booking first
  await supabaseAdmin
    .from("bookings")
    .update({ status: "CONFIRMED" })
    .eq("id", payment.booking_id);

  // 2. Generate meeting link (best effort - don't block on failure)
  if (!booking.meeting_link) {
    meetLink = await createGoogleMeetLinkOnly(
      booking.dietitian_id,
      {
        summary: booking.title || "Consultation Session",
        startTime: booking.start_time,
        endTime: booking.end_time,
      }
    );
    
    // Update booking with meeting link
    await supabaseAdmin
      .from("bookings")
      .update({ meeting_link: meetLink })
      .eq("id", payment.booking_id);
  }
  
  // 3. Update session request status to APPROVED
  const { data: sessionRequests } = await supabaseAdmin
    .from("session_requests")
    .select("id, status")
    .eq("client_email", userData.email.toLowerCase().trim())
    .eq("dietitian_id", booking.dietitian_id)
    .eq("event_type_id", booking.event_type_id)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1);
  
  if (sessionRequests && sessionRequests.length > 0) {
    await supabaseAdmin
      .from("session_requests")
      .update({ status: "APPROVED" })
      .eq("id", sessionRequests[0].id);
  }
}
```

---

## 3. Meeting Link Generation

### 3.1 Automatic Generation (During Payment)
**File:** `app/api/payments/verify/route.ts` & `lib/google-calendar.ts`

**Function:** `createGoogleMeetLinkOnly()`

**Process:**
1. Gets dietitian's Google OAuth tokens
2. Creates minimal Google Calendar event (no attendees to avoid sync issues)
3. Requests Google Meet link via Calendar API
4. Extracts Meet link from conference data
5. Updates booking record with `meeting_link`

**Code:**
```typescript
// lib/google-calendar.ts:75-137
export async function createGoogleMeetLinkOnly(
  dietitianId: string,
  eventDetails: {
    summary: string;
    startTime: string;
    endTime: string;
  }
): Promise<string> {
  const { accessToken, refreshToken } = await getOrRefreshToken(dietitianId);
  
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  
  const event = {
    summary: eventDetails.summary,
    start: { dateTime: eventDetails.startTime, timeZone: "Africa/Lagos" },
    end: { dateTime: eventDetails.endTime, timeZone: "Africa/Lagos" },
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  
  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
    conferenceDataVersion: 1,
  });
  
  const meetLink = response.data.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video"
  )?.uri || "";
  
  return meetLink;
}
```

### 3.2 Manual Generation (Retroactive)
**File:** `app/api/bookings/[id]/generate-meet-link/route.ts`

**Endpoint:** `POST /api/bookings/[id]/generate-meet-link`

**Use Cases:**
- Booking created without meeting link
- Dietitian needs to regenerate link
- Admin batch generation

**Access Control:**
- Booking user (client)
- Booking dietitian
- Admin users

---

## 4. Upcoming Meetings Display

### 4.1 User Side
**File:** `app/user-dashboard/upcoming-meetings/page.tsx`

**Data Source:**
- Real-time via Server-Sent Events (SSE) hook: `useBookingsStream()`
- Filters: `status === "CONFIRMED"` AND `startTime >= now`

**Display:**
- Meeting title
- Date & time
- Dietitian name
- Meeting link (clickable)
- Join meeting button

**Code:**
```typescript
// app/user-dashboard/upcoming-meetings/page.tsx:32-36
const upcomingBookings = bookings.filter(
  (b) => b.status === "CONFIRMED" && new Date(b.startTime) >= now
);
```

**Component:** `BookingsList` from `components/bookings/BookingsList.tsx`

### 4.2 Dietitian Side
**File:** `app/dashboard/bookings/upcoming/page.tsx`

**Data Source:**
- Server-side fetch (RSC)
- Filters: `dietitian_id === currentDietitian.id` AND `status === "CONFIRMED"` AND `start_time >= now`

**Query:**
```typescript
// app/dashboard/bookings/upcoming/page.tsx:72-96
const { data: bookingsData } = await supabaseAdmin
  .from("bookings")
  .select(`
    id,
    start_time,
    end_time,
    title,
    description,
    meeting_link,
    event_types:event_type_id (
      id,
      title,
      slug
    ),
    user:users!bookings_user_id_fkey (
      name,
      email
    )
  `)
  .eq("dietitian_id", dietitianId)
  .eq("status", "CONFIRMED")
  .gte("start_time", now)
  .order("start_time", { ascending: true });
```

**Display:**
- Client name/email
- Event type
- Date & time
- Meeting link
- Client contact info

---

## 5. Key Differences: Consultation vs Meal Plan

### 5.1 Session Request Flow

| Aspect | Consultation | Meal Plan |
|--------|-------------|-----------|
| **User Action** | Navigate to booking page → Select date/time → Pay | Direct payment → Request created |
| **Payment Timing** | After booking (date/time selected) | Before request (immediate) |
| **Booking Required** | ✅ Yes - Creates `bookings` record | ❌ No - Only `session_requests` |
| **Meeting Link** | ✅ Generated automatically | ❌ N/A |
| **Status Update** | `PENDING` → `APPROVED` (after payment) | `PENDING` → `APPROVED` (after payment) |

### 5.2 Payment Approval

**Consultation:**
```typescript
// Flow: Payment → Booking Created → Meeting Link → Session Request Approved
// app/api/payments/verify/route.ts
1. Payment verified
2. Booking confirmed
3. Meeting link generated
4. Session request approved
```

**Meal Plan:**
```typescript
// Flow: Payment → Session Request Created → Session Request Approved
// app/api/user/approve-request/[id]/route.ts
1. Payment verified
2. Session request approved directly
3. No booking created
4. No meeting link
```

### 5.3 User Dashboard Display

**Consultation:**
- **Pending:** Shows in "Session Requests" section
- **After Approval:** Removed from requests, appears in "Upcoming Meetings"
- **Redirect:** After payment success → `/user-dashboard/upcoming-meetings`

**Meal Plan:**
- **Pending:** Shows in "Session Requests" section
- **After Approval:** Moves to "Pending Meal Plans" section
- **Redirect:** After payment success → `/user-dashboard/meal-plan`
- **When PDF Sent:** Moves to "Received Meal Plans" section

### 5.4 Database Schema

**Consultation Flow:**
```
session_requests (PENDING)
    ↓
bookings (PENDING → CONFIRMED)
    ↓
payments (SUCCESS)
    ↓
session_requests (APPROVED)
bookings.meeting_link (generated)
```

**Meal Plan Flow:**
```
session_requests (PENDING)
    ↓
payments (SUCCESS)
    ↓
session_requests (APPROVED)
    ↓
meal_plans (created by dietitian)
    ↓
meal_plans.file_url (PDF uploaded)
```

### 5.5 Code Locations

**Consultation Approval:**
- User action: `app/user-dashboard/page.tsx:210-214` (navigate to booking)
- Booking creation: `app/api/bookings/route.ts:44-458`
- Payment verification: `app/api/payments/verify/route.ts:11-178`
- Link generation: `lib/google-calendar.ts:75-137`

**Meal Plan Approval:**
- User action: `app/user-dashboard/page.tsx:206-209` (open payment modal)
- Payment processing: `app/user-dashboard/page.tsx:233-271`
- Request approval: `app/api/user/approve-request/[id]/route.ts:6-76`
- Meal plan creation: `app/api/meal-plans/route.ts:77-418`

---

## 6. API Endpoints Summary

### Session Requests
- `GET /api/session-request` - Dietitian fetches their requests
- `POST /api/session-request` - Dietitian creates request
- `GET /api/user/session-requests` - User fetches their requests
- `POST /api/user/approve-request/[id]` - User approves request (meal plan)

### Bookings
- `POST /api/bookings` - Create booking (consultation)
- `GET /api/bookings` - Fetch bookings
- `POST /api/bookings/[id]/generate-meet-link` - Generate meeting link

### Payments
- `POST /api/payments/verify` - Verify payment & complete flow
- `POST /api/paystack/webhook` - Paystack webhook handler

### Meal Plans
- `POST /api/meal-plans` - Dietitian creates/sends meal plan
- `GET /api/meal-plans` - Fetch meal plans

---

## 7. State Transitions

### Consultation Request States
```
PENDING (dietitian creates)
    ↓
[User clicks Approve → Navigate to booking page]
    ↓
[User selects date/time]
    ↓
[User pays]
    ↓
APPROVED (payment verified)
    ↓
Booking: PENDING → CONFIRMED
Meeting link: Generated
```

### Meal Plan Request States
```
PENDING (dietitian creates OR user purchases)
    ↓
[User clicks Approve → Payment modal]
    ↓
[User pays]
    ↓
APPROVED (payment verified)
    ↓
[Dietitian uploads PDF]
    ↓
meal_plans.file_url populated
```

---

## 8. Error Handling

### Meeting Link Generation Failures
- **OAuth tokens missing:** Returns error, booking still confirmed
- **Google API error:** Falls back to placeholder link, booking confirmed
- **Network error:** Logged, doesn't block payment verification

### Payment Verification Failures
- **Booking not found:** Payment still verified, error logged
- **Session request lookup fails:** Payment verified, booking confirmed, error logged
- **Meeting link generation fails:** Booking confirmed, error logged

---

## 9. Real-time Updates

### User Dashboard
- **Bookings:** Server-Sent Events (SSE) via `useBookingsStream()` hook
- **Session Requests:** Polling via `fetchSessionRequests()`
- **Meal Plans:** SSE via `useMealPlansStream()` hook

### Dietitian Dashboard
- **Bookings:** Server-side rendering (RSC) with fresh data on each load
- **Session Requests:** Polling via API calls

---

## 10. Key Files Reference

### Core Flow Files
- `app/api/session-request/route.ts` - Session request CRUD
- `app/api/bookings/route.ts` - Booking creation
- `app/api/payments/verify/route.ts` - Payment verification & flow completion
- `app/api/user/approve-request/[id]/route.ts` - User approval (meal plan)

### UI Components
- `app/user-dashboard/page.tsx` - User dashboard with session requests
- `app/user-dashboard/book-a-call/page.tsx` - Booking flow
- `app/user-dashboard/upcoming-meetings/page.tsx` - User upcoming meetings
- `app/dashboard/bookings/upcoming/page.tsx` - Dietitian upcoming meetings
- `app/user-dashboard/meal-plan/page.tsx` - Meal plan page

### Utilities
- `lib/google-calendar.ts` - Google Meet link generation
- `hooks/useBookingsStream.ts` - Real-time bookings SSE hook
- `hooks/useMealPlansStream.ts` - Real-time meal plans SSE hook

---

## Summary

**Consultation Flow:**
1. Dietitian creates session request → `PENDING`
2. User approves → Navigates to booking page
3. User selects date/time → Creates booking → `PENDING`
4. User pays → Payment verified
5. Booking confirmed → Meeting link generated → Session request `APPROVED`
6. Appears in "Upcoming Meetings" for both user and dietitian

**Meal Plan Flow:**
1. Dietitian creates session request OR user purchases → `PENDING`
2. User approves → Payment modal
3. User pays → Payment verified → Session request `APPROVED`
4. Appears in "Pending Meal Plans"
5. Dietitian uploads PDF → Appears in "Received Meal Plans"

**Key Difference:** Consultations require booking creation and meeting link generation, while meal plans only require payment and PDF delivery.

