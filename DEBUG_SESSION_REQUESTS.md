# Session Requests Flow - Code Analysis

## 1. Creating Session Request (After Meal Plan Purchase)

### File: `app/user-dashboard/meal-plan/page.tsx` (lines 116-149)
```typescript
const handlePaymentSuccess = async (paymentData: any) => {
  if (!selectedPurchase) return;
  
  try {
    // Create a session request for the meal plan
    const response = await fetch("/api/user/session-requests", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dietitianId: selectedPurchase.dietitianId,
        requestType: "MEAL_PLAN",
        mealPlanType: selectedPurchase.packageName,
        notes: `Meal Plan Purchase: ${selectedPurchase.packageName}`,
        paymentData,
        price: selectedPurchase.price,
        currency: selectedPurchase.currency,
      }),
    });
    
    const responseData = await response.json();
    
    if (response.ok) {
      console.log("Session request created successfully:", responseData);
      window.location.reload();
    } else {
      console.error("Failed to create session request:", responseData);
      alert(`Failed to create session request: ${responseData.error}`);
    }
  } catch (err) {
    console.error("Error creating meal plan request:", err);
  }
};
```

### File: `app/api/user/session-requests/route.ts` (lines 179-302)
POST handler creates session request with:
- `request_type: "MEAL_PLAN"`
- `client_email: userEmail.toLowerCase().trim()` (normalized)
- `status: "PENDING"`
- `meal_plan_type: finalMealPlanType`
- `price` and `currency` from purchase

## 2. Fetching Session Requests (User Dashboard)

### File: `app/user-dashboard/page.tsx` (lines 136-161)
```typescript
const fetchSessionRequests = async () => {
  try {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/user/session-requests", {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const requests = data.requests || [];
    
    if (Array.isArray(requests) && requests.length > 0) {
      setSessionRequests(requests);
    } else {
      setSessionRequests([]);
    }
  } catch (err) {
    console.error("Error fetching session requests:", err);
    setError(err instanceof Error ? err.message : "Failed to load requests");
    setSessionRequests([]);
  } finally {
    setLoading(false);
  }
};
```

### File: `app/api/user/session-requests/route.ts` (lines 6-177)
GET handler:
- Fetches from `session_requests` table
- Filters by: `client_email = normalizedEmail` AND `status IN ("PENDING", "RESCHEDULE_REQUESTED")`
- Normalizes email: `userEmail.toLowerCase().trim()`
- Fetches related dietitian info
- Returns formatted requests

**Query:**
```sql
SELECT * FROM session_requests
WHERE client_email = <normalized_email>
  AND status IN ('PENDING', 'RESCHEDULE_REQUESTED')
ORDER BY created_at DESC
```

## 3. Displaying Session Requests

### File: `app/user-dashboard/page.tsx` (lines 300-337)
```typescript
<div className="mb-8">
  <h2>Requested Sessions & Meal Plans</h2>
  {loading ? (
    <div>Loading requests...</div>
  ) : error ? (
    <div>Error loading requests: {error}</div>
  ) : sessionRequests.length > 0 ? (
    <div className="space-y-4">
      {sessionRequests.map((request) => (
        <SessionRequestCard
          key={request.id}
          request={request}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      ))}
    </div>
  ) : (
    <div>
      <Mail icon />
      <p>No pending requests.</p>
      <p>Debug: sessionRequests.length = {sessionRequests.length}</p>
    </div>
  )}
</div>
```

## Database Schema

### Table: `session_requests`
```sql
CREATE TABLE session_requests (
  id UUID PRIMARY KEY,
  request_type TEXT CHECK (request_type IN ('CONSULTATION', 'MEAL_PLAN', 'RESCHEDULE_REQUEST')),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  dietitian_id UUID REFERENCES users(id),
  message TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RESCHEDULE_REQUESTED')),
  meal_plan_type TEXT,
  price DECIMAL(10, 2),
  currency TEXT DEFAULT 'NGN',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Potential Issues to Check:

1. **Email Mismatch**: Check if emails in database match exactly (case-sensitive comparison)
2. **Status Filter**: Only shows "PENDING" and "RESCHEDULE_REQUESTED" - if status is different, won't show
3. **RLS Policies**: Database RLS might be blocking the query
4. **User Authentication**: Make sure user is authenticated when fetching

## To Debug:

1. Check database directly:
```sql
SELECT id, client_email, request_type, meal_plan_type, status, created_at 
FROM session_requests 
WHERE request_type = 'MEAL_PLAN'
ORDER BY created_at DESC;
```

2. Check server logs for:
   - "Creating session request for user: <email>"
   - "Session request created successfully: <id>"
   - "Fetching session requests for user: <email>"

3. Check browser console for:
   - POST request to `/api/user/session-requests` status
   - GET request to `/api/user/session-requests` response
   - Any error messages

