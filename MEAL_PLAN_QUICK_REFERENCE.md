# Meal Plan PDF Issue - Quick Reference

## Problem Statement
Approved meal plan requests cannot display PDFs because `meal_plans` records are not properly linked to `session_requests`.

## Key Code Locations

### 1. Meal Plan Creation
**File**: `app/api/meal-plans/route.ts` (Lines 204-276)

```typescript
// ⚠️ ISSUE: session_request_id can be null on insert
const { data: mealPlan, error } = await supabaseAdmin
  .from("meal_plans")
  .insert({
    session_request_id: sessionRequestId || null,  // Can be null!
    // ... other fields
  });

// Attempts to fix null session_request_id
if (sessionRequestId && !mealPlan.session_request_id) {
  await supabaseAdmin
    .from("meal_plans")
    .update({ session_request_id: sessionRequestId })
    .eq("id", mealPlan.id);
}
```

### 2. Meal Plan Fetching (Stream Endpoint)
**File**: `app/api/session-requests/stream/route.ts` (Lines 45-143)

```typescript
// Primary query - fails if session_request_id is null
let { data: mealPlan } = await supabaseAdmin
  .from("meal_plans")
  .select("*")
  .eq("session_request_id", req.id)  // ⚠️ Returns null if not linked
  .maybeSingle();

// ✅ FIX: Enhanced alternative query
if (!mealPlan && req.status === "APPROVED") {
  // Strategy 1: Exact match
  // Strategy 2: Broader search (dietitian + user, unlinked only)
  // Auto-link if found
}
```

### 3. Frontend Display
**File**: `components/session-request/SessionRequestList.tsx` (Lines 257-283)

```typescript
{request.mealPlan?.fileUrl ? (
  <Button onClick={() => window.open(request.mealPlan.fileUrl, '_blank')}>
    View PDF
  </Button>
) : (
  <div className="text-yellow-400">
    PDF not available  {/* ✅ FIX: Better UX */}
  </div>
)}
```

## Database Query to Check Issue

```sql
-- Find approved requests without meal plans
SELECT 
  sr.id,
  sr.client_email,
  sr.meal_plan_type,
  sr.status,
  mp.id as meal_plan_id,
  mp.session_request_id,
  mp.file_url
FROM session_requests sr
LEFT JOIN meal_plans mp ON mp.session_request_id = sr.id
WHERE sr.request_type = 'MEAL_PLAN' 
  AND sr.status = 'APPROVED'
  AND mp.id IS NULL;  -- No meal plan found

-- Find orphaned meal plans
SELECT * FROM meal_plans WHERE session_request_id IS NULL;
```

## Fixes Applied

1. ✅ **Enhanced lookup**: Multiple search strategies in stream endpoint
2. ✅ **Auto-linking**: Automatically links orphaned meal plans
3. ✅ **Better UI**: Shows "PDF not available" instead of disabled button

## Next Steps

1. Run SQL query to check database state
2. Verify auto-linking works for existing orphaned records
3. Consider making `session_request_id` NOT NULL in schema
4. Add transaction wrapper for meal plan creation

