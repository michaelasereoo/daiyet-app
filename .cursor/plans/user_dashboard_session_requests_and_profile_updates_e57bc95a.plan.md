---
name: User Dashboard Session Requests and Profile Updates
overview: Add session/meal plan request management to user dashboard, integrate approval flows with payment and booking, add reschedule requests, and update profile settings to allow avatar changes while keeping name/email disabled.
todos:
  - id: "1"
    content: Create API endpoint /api/user/session-requests to fetch pending requests for authenticated user
    status: completed
  - id: "2"
    content: Create SessionRequestCard component to display individual requests with approve/reject buttons
    status: completed
  - id: "3"
    content: Create PaymentModal and PaymentSuccessModal components
    status: completed
  - id: "4"
    content: Update dashboard page to show 'Requested Sessions & Meal Plans' section
    status: completed
  - id: "5"
    content: Update Book a Call page to support pre-fill mode with query params
    status: completed
  - id: "6"
    content: Implement meal plan approval flow (payment → success → pending status)
    status: completed
  - id: "7"
    content: Implement consultation approval flow (booking pre-fill → payment → success)
    status: completed
  - id: "8"
    content: Implement reschedule request flow (pre-fill → date/time selection → no payment)
    status: completed
  - id: "9"
    content: "Update profile settings: enable avatar upload, disable name/email fields"
    status: completed
  - id: "10"
    content: Update meal plan page to show Paid & Pending status
    status: completed
  - id: "11"
    content: Create/update API endpoints for request approval and booking creation
    status: completed
---

# User Dashboard Session Requests and Profile Updates

## Overview
Add comprehensive session request management to the user dashboard with approval flows, payment integration, booking pre-fill, and profile settings updates.

## Changes Required

### 1. Create API Endpoint for User Session Requests
**File:** `app/api/user/session-requests/route.ts` (new file)
- Create GET endpoint that:
  - Fetches session requests where `clientEmail` matches the authenticated user's email
  - Filters by status "PENDING"
  - Includes meal plan and consultation requests
  - Returns requests with all necessary details (type, mealPlanType, eventType, price, message, dietitian info, etc.)

### 2. Create Session Request Components
**File:** `components/user/session-request-card.tsx` (new file)
- Component to display individual session/meal plan requests
- Shows request type (Consultation/Meal Plan), dietitian info, price, message
- "Approve" and "Reject" buttons
- Different display for meal plans vs consultations vs reschedule requests

**File:** `components/user/payment-modal.tsx` (new file)
- Payment modal component for meal plans and consultations
- Shows order summary (amount, item description)
- Integrates with payment provider (mock for now, can integrate Paystack later)
- Shows success state after payment

**File:** `components/user/payment-success-modal.tsx` (new file)
- Success screen after payment
- Shows confirmation details
- Option to view booking/meal plan

### 3. Update User Dashboard Page
**File:** `app/user-dashboard/page.tsx`
- Add new section: "Requested Sessions & Meal Plans" above "Upcoming Meetings"
- Fetch session requests from `/api/user/session-requests`
- Display requests using `SessionRequestCard` component
- Handle approve/reject actions
- Show empty state when no requests

### 4. Update Book a Call Page for Pre-filled Booking
**File:** `app/user-dashboard/book-a-call/page.tsx`
- Accept URL query params or route state: `?prefill=true&dietitianId=...&eventTypeId=...&message=...`
- When pre-filled:
  - Pre-populate step 2 (dietitian selection) with `dietitianId`
  - Pre-populate step 1 (information) with user data (name, email from session)
  - Pre-populate notes/complaints with request message (if provided)
  - Make certain fields read-only where appropriate
  - For reschedule: disable dietitian selection and info fields, skip directly to step 3 (calendar)
  - Track if this is a reschedule request (no payment step)

**State Management:**
- Add props or query params handler to detect pre-fill mode
- Store original request ID to update status after booking completion
- Skip payment step if reschedule request

### 5. Update Meal Plan Page
**File:** `app/user-dashboard/meal-plan/page.tsx`
- Add "Paid & Pending" status display in sidebar or status badges
- Update pending meal plans to show "Paid & Pending" when payment completed
- After payment success, move meal plan from "Requested" to "Pending Meal Plans" section

### 6. Handle Approval Flows

**Meal Plan Approval Flow:**
- User clicks "Approve" on meal plan request
- Open payment modal with meal plan details and price
- On payment success:
  - Call API to update session request status to "APPROVED" 
  - Create meal plan order record (mock for now)
  - Show success modal
  - Move to "Pending Meal Plans" section with "Paid & Pending" status

**Consultation Approval Flow:**
- User clicks "Approve" on consultation request
- Navigate to `/user-dashboard/book-a-call?prefill=true&dietitianId=X&eventTypeId=Y&requestId=Z`
- User completes booking flow (selects date/time)
- At checkout step (step 4), show payment
- On payment success:
  - Create booking record
  - Update session request status to "APPROVED"
  - Show success screen
  - Redirect to upcoming meetings page

**Reschedule Request Flow:**
- Add reschedule request type to session requests (status: "RESCHEDULE_REQUESTED")
- User sees reschedule requests in dashboard
- User clicks "Accept Reschedule":
  - Navigate to `/user-dashboard/book-a-call?prefill=true&reschedule=true&requestId=X&dietitianId=Y`
  - Pre-fill all fields (disabled)
  - Skip to step 3 (date/time selection)
  - User selects new date/time
  - On confirmation (no payment):
    - Update booking with new date/time
    - Update reschedule request status to "ACCEPTED"
    - Show success screen

### 7. Update Profile Settings Page
**File:** `app/user-dashboard/profile-settings/page.tsx`
- Enable "Upload Photo" button (remove disabled state)
- Make name and email fields disabled/read-only
- Fetch name/email from Google auth session
- Display message: "Name and email are synced from your Google account"
- Remove or disable "Username" field
- Remove or disable "About" field (or keep if needed)
- Remove "Save Changes" button (or keep disabled)

**File:** `app/user-dashboard/settings/profile/page.tsx` (if different)
- Apply same changes as above

### 8. Create/Update API Endpoints

**Update:** `app/api/session-request/[id]/route.ts`
- Modify PUT endpoint to handle user approval:
  - Accept `approver: "USER"` or `approver: "DIETITIAN"`
  - Update status to "APPROVED" when user approves
  - Include payment information when available

**Create:** `app/api/user/approve-request/[id]/route.ts` (new file)
- POST endpoint for user to approve a session request
- Validates user owns the request (by email)
- Updates request status
- Creates booking (for consultations) or meal plan order (for meal plans)
- Returns success response

### 9. Update Booking Creation API
**File:** `app/api/bookings/route.ts` (if exists) or create new endpoint
- POST endpoint to create booking from approved session request
- Accepts: `sessionRequestId`, `selectedDate`, `selectedTime`, `dietitianId`, `eventTypeId`, `userId`
- Creates booking record with status "CONFIRMED"
- Links to payment if consultation type requires payment

### 10. Navigation and State Management
- Add loading states during approval/payment flows
- Handle error states
- Refresh dashboard after approvals
- Update meal plan sidebar status dynamically

## Implementation Details

**Request Types to Handle:**
- `CONSULTATION` - Regular consultation request (requires booking + payment)
- `MEAL_PLAN` - Meal plan request (requires payment only)
- `RESCHEDULE_REQUEST` - Reschedule request (requires new date/time, no payment)

**Status Flow:**
- `PENDING` → User approves → `APPROVED` (after payment)
- For reschedule: `RESCHEDULE_REQUESTED` → User accepts → `ACCEPTED` (after new date/time selected)

**Pre-fill Data Structure:**
```
/book-a-call?prefill=true&dietitianId=xxx&eventTypeId=yyy&requestId=zzz&message=notes&reschedule=false
```

**Payment Integration:**
- Use mock payment for now (just show success after button click)
- Structure ready for Paystack integration later
- Store payment status with request/booking

## Edge Cases
1. Multiple pending requests - handle list display
2. Request expires or becomes invalid - show error
3. Payment failure - allow retry
4. Booking conflict - validate date/time availability before allowing selection
5. User already approved/rejected - prevent duplicate actions

## Testing Considerations
- Verify pre-fill works correctly for all request types
- Test payment flow for meal plans and consultations
- Verify reschedule flow skips payment
- Ensure profile settings correctly disable name/email
- Test avatar upload functionality