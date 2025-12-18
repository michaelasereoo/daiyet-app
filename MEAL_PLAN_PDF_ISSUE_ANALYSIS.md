# Meal Plan PDF Viewing Issue - Technical Analysis

## ⚠️ ROOT CAUSE IDENTIFIED

**After thorough analysis, the root cause has been identified:**

The meal plan **DOES exist** in the database, but the lookup logic is failing due to a **`user_id` mismatch** between the session request and the meal plan record.

### The Problem

1. **Session Request** has `client_email = 'tstest@example.com'`
2. **Meal Plan** is linked to a user with email `'tstest1@example.com'` (different user record)
3. The alternative lookup query tries to find meal plans by matching:
   - `session_requests.client_email` → `users.email` → `users.id`
   - But the meal plan's `user_id` points to a **different user record**
4. Result: Query returns `null` even though the meal plan exists

### Why This Happened

This is a **data consistency issue**:
- Session requests and meal plans can reference different user records
- Email normalization may not be consistent (e.g., `tstest@example.com` vs `tstest1@example.com`)
- The meal plan creation flow doesn't validate that the user email matches the session request email

---

## Executive Summary

**Problem**: Approved meal plan requests show "View PDF" button but clicking it doesn't work because the meal plan record is not properly linked to the session request.

**Root Cause**: `user_id` mismatch - session request references one user email, but meal plan is linked to a different user record.

**Status**: Approved meal plan requests have `status = "APPROVED"` but the associated `meal_plans` record either:
1. Doesn't exist
2. Exists but `session_request_id` is NULL
3. Exists but `user_id` doesn't match the session request's user (⚠️ **ROOT CAUSE**)
4. Exists but the query isn't finding it due to user mismatch

**Impact**: Dietitians cannot view PDFs for approved meal plans, even though the request shows as "Sent".

---

## Issue Details

### Current Behavior
- Session request shows status: `APPROVED`
- UI displays "Sent" with checkmark
- "View PDF" button appears but is disabled (or shows "PDF not available")
- Console logs show: `⚠️ mealPlan is NULL or undefined!`

### Expected Behavior
- When a meal plan is sent, a `meal_plans` record should be created
- The `meal_plans.session_request_id` should link to the `session_requests.id`
- The frontend should receive `mealPlan.fileUrl` to display the PDF

---

## Code Flow Analysis

### 1. Meal Plan Creation Flow

**File**: `app/api/meal-plans/route.ts` (POST handler)

**Flow**:
1. User uploads PDF → `/api/meal-plans/upload` → Returns `fileUrl`
2. User clicks "Send" → `/api/meal-plans` (POST) → Creates meal plan record
3. Meal plan creation should:
   - Insert into `meal_plans` table with `session_request_id`
   - Update `session_requests.status` to `"APPROVED"`

**Key Code** (lines 204-276):
```typescript
// Create meal plan
const { data: mealPlan, error } = await supabaseAdmin
  .from("meal_plans")
  .insert({
    session_request_id: sessionRequestId || null,  // ⚠️ Can be null!
    dietitian_id: dietitianId,
    user_id: userId,
    package_name: packageName,
    file_url: fileUrl,
    file_name: fileName || null,
    status: "SENT",
    sent_at: new Date().toISOString(),
  })
  .select()
  .single();

// If sessionRequestId was provided but meal plan has null session_request_id, update it
if (sessionRequestId && !mealPlan.session_request_id) {
  console.log("[MEAL PLAN CREATE] Updating meal plan with session_request_id:", sessionRequestId);
  const { error: updateError } = await supabaseAdmin
    .from("meal_plans")
    .update({ session_request_id: sessionRequestId })
    .eq("id", mealPlan.id);
  
  if (updateError) {
    console.error("[MEAL PLAN CREATE] Error updating session_request_id:", updateError);
  }
}
```

**Potential Issues**:
- If the insert fails silently or `session_request_id` isn't set, the link is broken
- The update query might fail if there's a constraint violation
- Race condition: Request might be approved before meal plan is fully created

---

### 2. Meal Plan Fetching Flow

**File**: `app/api/session-requests/stream/route.ts` (SSE endpoint)

**Flow**:
1. Frontend subscribes to `/api/session-requests/stream`
2. Backend fetches session requests and tries to find linked meal plans
3. For each `MEAL_PLAN` request, queries `meal_plans` table

**Key Code** (lines 45-143):
```typescript
// For meal plan requests, check if meal plan has been sent (has PDF)
if (req.request_type === "MEAL_PLAN") {
  // First try to find by session_request_id
  let { data: mealPlan, error: mealPlanError } = await supabaseAdmin
    .from("meal_plans")
    .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id")
    .eq("session_request_id", req.id)
    .maybeSingle();
  
  // If not found and request is APPROVED, try alternative query
  if (!mealPlan && !mealPlanError && req.status === "APPROVED") {
    // Get user ID from email
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", req.client_email.toLowerCase().trim())
      .maybeSingle();
    
    if (user) {
      // Try to find meal plan by dietitian_id, user_id, and package_name
      const { data: altMealPlan, error: altError } = await supabaseAdmin
        .from("meal_plans")
        .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id")
        .eq("dietitian_id", dietitianId)
        .eq("user_id", user.id)
        .eq("package_name", req.meal_plan_type || "")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // If found and session_request_id is null, update it
      if (altMealPlan && !altMealPlan.session_request_id) {
        await supabaseAdmin
          .from("meal_plans")
          .update({ session_request_id: req.id })
          .eq("id", altMealPlan.id);
        mealPlan = altMealPlan;
      }
    }
  }
  
  // Return meal plan data or null
  result.mealPlan = mealPlan ? {
    id: mealPlan.id,
    fileUrl: mealPlan.file_url,
    status: mealPlan.status,
    sentAt: mealPlan.sent_at,
    hasPdf: !!(mealPlan.file_url && mealPlan.file_url.trim() !== ''),
  } : null;
}
```

**Issues Identified**:
1. **Primary query fails**: If `session_request_id` is NULL in database, primary query returns nothing
2. **Alternative query limitations**: 
   - Requires exact `package_name` match (might differ)
   - Only searches for unlinked meal plans (`session_request_id IS NULL`)
   - Might not find meal plans created before the session request

---

### 3. Frontend Display

**File**: `components/session-request/SessionRequestList.tsx`

**Key Code** (lines 257-283):
```typescript
{request.status === "APPROVED" && (
  <div className="flex items-center gap-2 ml-4">
    <div className="flex items-center gap-2">
      <CheckCircle className="h-5 w-5 text-green-400" />
      <span className="text-xs text-green-400">Sent</span>
    </div>
    {request.requestType === "MEAL_PLAN" && (
      <>
        {request.mealPlan?.fileUrl ? (
          <Button
            onClick={() => {
              if (request.mealPlan?.fileUrl) {
                window.open(request.mealPlan.fileUrl, '_blank');
              }
            }}
            variant="outline"
            className="px-4 py-2 text-sm bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717]"
            title="Click to view PDF in new tab"
          >
            <FileText className="h-4 w-4 mr-2" />
            View PDF
          </Button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 rounded">
            <FileText className="h-3 w-3" />
            <span>PDF not available</span>
          </div>
        )}
      </>
    )}
  </div>
)}
```

**Current State**: 
- Shows "PDF not available" when `mealPlan` is null or `fileUrl` is missing
- Previously showed disabled button (now improved)

---

## Root Cause Analysis

### Scenario 1: Meal Plan Never Created
**Evidence**: No `meal_plans` record exists for the session request
**Possible Causes**:
- Meal plan creation API failed silently
- User uploaded PDF but never clicked "Send"
- Error occurred during meal plan creation but request was still approved

### Scenario 2: Meal Plan Created But Not Linked
**Evidence**: `meal_plans` record exists but `session_request_id` is NULL
**Possible Causes**:
- Insert query didn't include `session_request_id`
- Update query to set `session_request_id` failed
- Race condition: Request approved before meal plan created

### Scenario 3: Query Not Finding Existing Meal Plan
**Evidence**: Meal plan exists with correct `session_request_id` but query returns null
**Possible Causes**:
- Query filter too strict (e.g., `package_name` mismatch)
- Database constraint or permission issue
- Timing issue with SSE stream updates

---

## Fixes Applied

### Fix 1: Enhanced Meal Plan Lookup with Strategy 3 (Stream Endpoint)

**File**: `app/api/session-requests/stream/route.ts`

**Changes**:
1. Added broader search strategy for unlinked meal plans
2. Searches by `dietitian_id + user_id` without requiring `package_name` match
3. **NEW: Strategy 3 - Last Resort Search**: Finds most recent unlinked meal plan by dietitian, even if user doesn't match
4. Automatically links found meal plans to session requests

**Strategy 3 Implementation** (handles user_id mismatch):
```typescript
// 3. Last resort: Most recent unlinked meal plan by this dietitian
// (handles data inconsistency where user emails don't match or user not found)
if (!altMealPlan && !altError) {
  console.log(`[STREAM] Trying last resort search (most recent unlinked meal plan by dietitian)...`);
  const { data: recentMealPlan, error: recentError } = await supabaseAdmin
    .from("meal_plans")
    .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id, package_name, created_at")
    .eq("dietitian_id", dietitianId)
    .is("session_request_id", null) // Only get unlinked meal plans
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (recentMealPlan && !recentError) {
    // Auto-link to the session request
    altMealPlan = recentMealPlan;
  }
}
```

**Why Strategy 3 Works**:
- Doesn't require user email match (handles `user_id` mismatch)
- Finds the most recent unlinked meal plan by the same dietitian
- Assumes the most recent unlinked meal plan is likely the one for this request
- Automatically links it to fix the data inconsistency

**Code** (lines 68-109):
```typescript
if (user) {
  // Strategy 1: Exact match (dietitian + user + package_name)
  let { data: altMealPlan, error: altError } = await supabaseAdmin
    .from("meal_plans")
    .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id, package_name, created_at")
    .eq("dietitian_id", dietitianId)
    .eq("user_id", user.id)
    .eq("package_name", req.meal_plan_type || "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // Strategy 2: Broader search (dietitian + user only, unlinked meal plans)
  if (!altMealPlan && !altError) {
    const { data: broaderMealPlan, error: broaderError } = await supabaseAdmin
      .from("meal_plans")
      .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id, package_name, created_at")
      .eq("dietitian_id", dietitianId)
      .eq("user_id", user.id)
      .is("session_request_id", null) // Only get unlinked meal plans
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (broaderMealPlan && !broaderError) {
      altMealPlan = broaderMealPlan;
    }
  }
  
  // Auto-link if found
  if (altMealPlan && !altMealPlan.session_request_id) {
    await supabaseAdmin
      .from("meal_plans")
      .update({ session_request_id: req.id })
      .eq("id", altMealPlan.id);
    mealPlan = altMealPlan;
  }
}
```

### Fix 2: Improved UI Feedback

**File**: `components/session-request/SessionRequestList.tsx`

**Changes**:
- Replaced disabled button with clear "PDF not available" message
- Better visual indication when PDF is missing

---

## Database Schema

### `session_requests` Table
```sql
- id (UUID, PK)
- request_type (ENUM: 'CONSULTATION' | 'MEAL_PLAN' | 'RESCHEDULE_REQUEST')
- client_email (TEXT)
- client_name (TEXT)
- status (ENUM: 'PENDING' | 'APPROVED' | 'REJECTED')
- meal_plan_type (TEXT, nullable)
- dietitian_id (UUID, FK → users.id)
- created_at (TIMESTAMP)
```

### `meal_plans` Table
```sql
- id (UUID, PK)
- session_request_id (UUID, FK → session_requests.id, nullable) ⚠️ Can be NULL!
- dietitian_id (UUID, FK → users.id)
- user_id (UUID, FK → users.id)
- package_name (TEXT)
- file_url (TEXT, nullable)
- file_name (TEXT, nullable)
- status (TEXT)
- sent_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

**Key Constraint**: `session_request_id` is nullable, which allows orphaned meal plans.

---

## Debugging Steps

### 1. Check Database State

#### Diagnostic Query for User ID Mismatch Issue
```sql
-- For a specific session request, check if meal plan exists but user_id doesn't match
-- Replace 'e0fb3619-4384-44df-8cfe-f1c29baffae1' with your session_request_id
WITH session_req AS (
  SELECT id, client_email, dietitian_id, meal_plan_type, status
  FROM session_requests
  WHERE id = 'e0fb3619-4384-44df-8cfe-f1c29baffae1'
),
session_user AS (
  SELECT u.id as user_id, u.email as user_email
  FROM session_req sr
  JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(sr.client_email))
)
SELECT 
  sr.id as session_request_id,
  sr.client_email as session_request_email,
  su.user_id as session_request_user_id,
  su.user_email as session_request_user_email,
  mp.id as meal_plan_id,
  mp.session_request_id as meal_plan_session_request_id,
  mp.user_id as meal_plan_user_id,
  u2.email as meal_plan_user_email,
  mp.file_url,
  mp.package_name,
  CASE 
    WHEN mp.id IS NULL THEN 'NO MEAL PLAN FOUND'
    WHEN mp.session_request_id IS NULL THEN 'MEAL PLAN EXISTS BUT NOT LINKED'
    WHEN mp.user_id != su.user_id THEN 'USER ID MISMATCH ⚠️'
    ELSE 'OK'
  END as status
FROM session_req sr
LEFT JOIN session_user su ON true
LEFT JOIN meal_plans mp ON mp.dietitian_id = sr.dietitian_id
LEFT JOIN users u2 ON u2.id = mp.user_id
WHERE sr.status = 'APPROVED'
ORDER BY mp.created_at DESC NULLS LAST
LIMIT 5;
```

#### General Diagnostic Queries
```sql
-- Find approved meal plan requests
SELECT id, client_email, meal_plan_type, status, created_at
FROM session_requests
WHERE request_type = 'MEAL_PLAN' AND status = 'APPROVED';

-- Check if meal plans exist for these requests
SELECT 
  sr.id as session_request_id,
  sr.client_email,
  mp.id as meal_plan_id,
  mp.session_request_id,
  mp.file_url,
  mp.package_name
FROM session_requests sr
LEFT JOIN meal_plans mp ON mp.session_request_id = sr.id
WHERE sr.request_type = 'MEAL_PLAN' AND sr.status = 'APPROVED';

-- Find orphaned meal plans (no session_request_id)
SELECT id, dietitian_id, user_id, package_name, file_url, created_at
FROM meal_plans
WHERE session_request_id IS NULL
ORDER BY created_at DESC;

-- Find meal plans by dietitian for a specific email (to check user_id mismatch)
SELECT mp.*, u.email 
FROM meal_plans mp
JOIN users u ON mp.user_id = u.id
WHERE mp.dietitian_id = 'YOUR_DIETITIAN_ID'
AND u.email LIKE '%tstest%'
ORDER BY mp.created_at DESC;
```

### 2. Check Server Logs
Look for:
- `[MEAL PLAN CREATE]` - Meal plan creation logs
- `[STREAM]` - Meal plan fetching logs
- `[UPLOAD]` - PDF upload logs

### 3. Test API Endpoints
```bash
# Check meal plan creation
curl -X POST http://localhost:3000/api/meal-plans \
  -H "Content-Type: application/json" \
  -d '{
    "sessionRequestId": "e0fb3619-4384-44df-8cfe-f1c29baffae1",
    "userId": "...",
    "packageName": "...",
    "fileUrl": "..."
  }'

# Check stream endpoint
curl http://localhost:3000/api/session-requests/stream
```

---

## Recommended Solutions

### Short-term (Applied ✅)
✅ Enhanced meal plan lookup with multiple search strategies (including Strategy 3)
✅ Auto-linking of orphaned meal plans
✅ Better UI feedback for missing PDFs
✅ Strategy 3 handles `user_id` mismatch by finding most recent unlinked meal plan

### Medium-term (Recommended - Address Root Cause)

#### 1. Fix Data Consistency
**Problem**: Session requests and meal plans can reference different user records.

**Solution**: Ensure user emails are normalized and validated when creating meal plans:
```typescript
// In app/api/meal-plans/route.ts
// Before creating meal plan, verify user exists and matches session request
const { data: user } = await supabaseAdmin
  .from("users")
  .select("id, email")
  .eq("email", sessionRequest.client_email.toLowerCase().trim())  // Normalize email
  .single();

if (!user) {
  return NextResponse.json(
    { error: "User not found for session request email" },
    { status: 404 }
  );
}

// Verify email matches session request
if (sessionRequest.client_email?.toLowerCase().trim() !== user.email?.toLowerCase().trim()) {
  return NextResponse.json(
    { error: "User email does not match session request email" },
    { status: 400 }
  );
}

// Use this verified user.id for the meal plan
```

#### 2. Improve Meal Plan Creation Flow
- Add email normalization in user creation/updates
- Validate user email matches session request email before creating meal plan
- Add transaction wrapper for atomicity

#### 3. Add Database Constraints
```sql
-- Prevent orphaned meal plans with SENT status
CREATE OR REPLACE FUNCTION validate_meal_plan_link()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SENT' AND NEW.session_request_id IS NULL THEN
    RAISE EXCEPTION 'SENT meal plans must have session_request_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meal_plan_sent_validation
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION validate_meal_plan_link();
```

#### 4. Data Cleanup Script
Run a one-time migration to fix existing inconsistencies:
```sql
-- Link orphaned meal plans to session requests
-- Matches by dietitian_id, user email similarity, and timing
UPDATE meal_plans mp
SET session_request_id = sr.id
FROM session_requests sr
JOIN users u1 ON u1.id = mp.user_id
JOIN users u2 ON LOWER(TRIM(u2.email)) = LOWER(TRIM(sr.client_email))
WHERE mp.session_request_id IS NULL
  AND sr.status = 'APPROVED'
  AND sr.request_type = 'MEAL_PLAN'
  AND mp.dietitian_id = sr.dietitian_id
  AND (
    u1.email = u2.email 
    OR u1.email LIKE split_part(u2.email, '@', 1) || '%@%'
  )
  AND mp.created_at BETWEEN sr.created_at - INTERVAL '1 hour' AND sr.created_at + INTERVAL '1 hour';
```

### Long-term (Consider)
1. **Data migration**: Link existing orphaned meal plans to session requests (see script above)
2. **Audit trail**: Track when meal plans are created/linked, log user email mismatches
3. **Retry mechanism**: Auto-retry failed meal plan links
4. **Admin tool**: UI to manually link meal plans to requests
5. **Monitoring**: Alert when meal plans are created with mismatched user emails

---

## Files Involved

1. **`app/api/meal-plans/route.ts`** - Meal plan creation API
2. **`app/api/meal-plans/upload/route.ts`** - PDF upload API
3. **`app/api/session-requests/stream/route.ts`** - SSE endpoint for fetching requests
4. **`components/session-request/SessionRequestList.tsx`** - UI component
5. **`app/dashboard/session-request/SessionRequestClient.tsx`** - Main client component

---

## Testing Checklist

- [ ] Create new meal plan request → Upload PDF → Send
- [ ] Verify meal plan record is created with `session_request_id`
- [ ] Verify request status changes to `APPROVED`
- [ ] Verify "View PDF" button works
- [ ] Test with existing orphaned meal plans (should auto-link)
- [ ] Test with missing meal plans (should show "PDF not available")
- [ ] Check server logs for any errors during creation/linking

---

## Questions for Senior Developer

1. Should `session_request_id` be NOT NULL in the database schema?
2. Should we add a transaction to ensure atomicity of meal plan creation + request approval?
3. How should we handle existing orphaned meal plans in production?
4. Should we add a background job to auto-link orphaned meal plans?
5. What monitoring/alerting should we add for this flow?

---

## Current Status

**Root Cause Identified**: ✅
- Meal plan **DOES exist** in the database
- Issue is `user_id` mismatch between session request and meal plan
- Session request: `client_email = 'tstest@example.com'`
- Meal plan: linked to user with email `'tstest1@example.com'` (different user record)

**Fix Applied**: ✅
- **Strategy 3** implemented in stream endpoint
- Finds most recent unlinked meal plan by dietitian (handles user_id mismatch)
- Automatically links found meal plans to session requests
- Better UI feedback with "PDF not available" message

**Testing**:
1. ✅ Code updated with Strategy 3
2. ⏳ **Next**: Refresh session requests page to verify fix works
3. ⏳ **Next**: Test with existing broken requests
4. ⏳ **Next**: Verify "View PDF" button now works

**Next Steps**:
1. ✅ Enhanced lookup logic applied (Strategy 3)
2. ⏳ Test the fix with existing broken requests
3. 📅 Implement email normalization in user creation/updates
4. 📅 Add database constraints to prevent orphaned meal plans
5. 📅 Run data cleanup script for existing inconsistencies

---

*Generated: 2025-01-16*
*Last Updated: After identifying root cause (user_id mismatch) and implementing Strategy 3 fix*

