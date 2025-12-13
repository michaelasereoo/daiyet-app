# Batch 1 Testing Checklist - Event Types API & Authentication

## Prerequisites
- Google OAuth configured in Supabase
- Test user accounts created:
  - Dietitian: `michaelasereoo@gmail.com` (role: DIETITIAN)
  - User: `michaelasereo@gmail.com` (role: USER)
  - Admin: `asereopeyemimichael@gmail.com` (role: ADMIN)

---

## ✅ Test 1: Authentication Required (Negative Tests)

### 1.1 Access Event Types Without Login
- **Action**: Try to access `/api/event-types` without being logged in
- **Expected**: 
  - Should redirect to `/dietitian-login` 
  - OR return 401/403 error if accessing via API directly
- **Test URL**: 
  - Browser: `http://localhost:3000/dashboard/event-types`
  - API: `curl http://localhost:3000/api/event-types`

### 1.2 Access Dashboard Without Login
- **Action**: Try to access `/dashboard` directly
- **Expected**: Redirected to `/dietitian-login?callbackUrl=...`
- **Test URL**: `http://localhost:3000/dashboard`

---

## ✅ Test 2: Dietitian Authentication Flow

### 2.1 Login as Dietitian
- **Action**: 
  1. Go to `/dietitian-login`
  2. Click "Continue with Google"
  3. Sign in with `michaelasereoo@gmail.com`
- **Expected**: 
  - Redirects to Google OAuth consent screen
  - After approval, redirects back to `/dashboard`
  - Can access dashboard and event types

### 2.2 View Event Types (GET /api/event-types)
- **Action**: 
  1. While logged in as dietitian, navigate to `/dashboard/event-types`
  2. OR make API call: `GET /api/event-types`
- **Expected**: 
  - ✅ Should return only event types owned by this dietitian
  - ✅ Should NOT show event types from other dietitians
  - ✅ Should return 200 status with event types array

### 2.3 View Single Event Type (GET /api/event-types/[id])
- **Action**: 
  1. Click on an event type from the list
  2. OR access: `/dashboard/event-types/[event-type-id]`
- **Expected**: 
  - ✅ Should show event type details if it belongs to logged-in dietitian
  - ✅ Should return 404 if event type belongs to another dietitian
  - ✅ Should NOT show event types from other dietitians

### 2.4 Create Event Type (POST /api/event-types)
- **Action**: 
  1. Click "New" button on event types page
  2. Fill in event type details
  3. Submit form
- **Expected**: 
  - ✅ Event type created successfully
  - ✅ Event type is associated with logged-in dietitian's user_id
  - ✅ Returns 201 status with created event type

### 2.5 Update Event Type (PUT /api/event-types/[id])
- **Action**: 
  1. Edit an existing event type (that belongs to you)
  2. Change title, price, etc.
  3. Save changes
- **Expected**: 
  - ✅ Event type updated successfully
  - ✅ Returns updated event type
  - ✅ Cannot update event types that don't belong to you (404)

### 2.6 Delete Event Type (DELETE /api/event-types/[id])
- **Action**: 
  1. Delete an event type from the list
- **Expected**: 
  - ✅ Event type deleted successfully
  - ✅ Returns success response
  - ✅ Cannot delete event types that don't belong to you (404)

---

## ✅ Test 3: Cross-User Isolation (Security)

### 3.1 Dietitian Cannot Access Other Dietitian's Data
- **Setup**: 
  1. Create event type as Dietitian A (`michaelasereoo@gmail.com`)
  2. Note the event type ID
  3. Logout
  4. Login as a different dietitian (if you have one)
- **Action**: Try to access the event type ID from Dietitian A
- **Expected**: 
  - ✅ Should return 404 "Event type not found"
  - ✅ Should NOT see the event type in list
  - ✅ Should NOT be able to update/delete it

### 3.2 User Role Cannot Access Dietitian Routes
- **Action**: 
  1. Logout
  2. Login as regular USER (`michaelasereo@gmail.com`)
  3. Try to access `/dashboard/event-types`
- **Expected**: 
  - ✅ Should be redirected to `/user-dashboard`
  - ✅ Should NOT have access to dietitian dashboard
  - ✅ API calls should return 403 Forbidden

---

## ✅ Test 4: Error Handling

### 4.1 Unauthorized Access
- **Action**: Make API call without authentication token/cookies
- **Expected**: 
  - ✅ Returns 401 Unauthorized
  - ✅ Clear error message

### 4.2 Forbidden Access (Wrong Role)
- **Action**: USER role tries to access dietitian-only endpoint
- **Expected**: 
  - ✅ Returns 403 Forbidden
  - ✅ Clear error message: "Forbidden: Dietitian access required"

### 4.3 Invalid Event Type ID
- **Action**: Try to access `/api/event-types/invalid-id`
- **Expected**: 
  - ✅ Returns 404 Not Found
  - ✅ Clear error message

---

## ✅ Test 5: Browser Session Management

### 5.1 Session Persistence
- **Action**: 
  1. Login as dietitian
  2. Close browser tab
  3. Reopen and go to `/dashboard`
- **Expected**: 
  - ✅ Should remain logged in (session persists)
  - ✅ Should NOT require re-authentication

### 5.2 Session Expiry (if applicable)
- **Action**: Wait for session to expire (or manually clear cookies)
- **Expected**: 
  - ✅ Should redirect to login page
  - ✅ Should preserve callback URL for redirect after login

---

## 🐛 Common Issues to Watch For

1. **CORS Errors**: If API calls fail with CORS, check middleware configuration
2. **Cookie Issues**: Ensure cookies are being set correctly (check browser DevTools → Application → Cookies)
3. **Redirect Loops**: If stuck in login loop, check middleware logic
4. **404 on All Routes**: Check if middleware is blocking routes incorrectly
5. **Session Not Found**: Verify Supabase auth is working and user exists in database

---

## 📝 Test Results Template

```
✅ Test 1.1: Unauthenticated Access - PASS/FAIL
✅ Test 2.1: Dietitian Login - PASS/FAIL
✅ Test 2.2: View Event Types - PASS/FAIL
✅ Test 2.3: View Single Event Type - PASS/FAIL
✅ Test 2.4: Create Event Type - PASS/FAIL
✅ Test 2.5: Update Event Type - PASS/FAIL
✅ Test 2.6: Delete Event Type - PASS/FAIL
✅ Test 3.1: Cross-User Isolation - PASS/FAIL
✅ Test 3.2: Role-Based Access - PASS/FAIL
✅ Test 4.1: Unauthorized Errors - PASS/FAIL
✅ Test 4.2: Forbidden Errors - PASS/FAIL
✅ Test 5.1: Session Persistence - PASS/FAIL
```

---

## 🚀 Quick Manual Test Script

1. **Start Dev Server**: `npm run dev`
2. **Open Browser**: Go to `http://localhost:3000/dashboard`
3. **Should Redirect**: To `/dietitian-login`
4. **Login**: Click "Continue with Google", sign in with dietitian account
5. **Should Redirect**: Back to `/dashboard`
6. **Navigate**: Click "Event Types" in sidebar
7. **Verify**: See your event types (if any exist)
8. **Create**: Click "New", create a test event type
9. **Verify**: Event type appears in list
10. **Edit**: Click on the event type, make changes, save
11. **Verify**: Changes are saved
12. **Delete**: Delete the test event type
13. **Verify**: Event type removed from list

---

## 📊 Success Criteria

Batch 1 is successful if:
- ✅ All authentication checks work (401/403 errors)
- ✅ Dietitians can only see/modify their own event types
- ✅ Users with wrong roles are properly blocked
- ✅ No hardcoded email addresses in API responses
- ✅ All CRUD operations work with authenticated sessions
- ✅ No console errors related to authentication
