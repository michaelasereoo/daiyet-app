# Session Request Sidebar Issue - Root Cause & Solution

## Problem Description

**Issue**: When navigating to `/dashboard/session-request`, the sidebar's profile image and name were changing/flickering, and console errors were appearing: "Failed to fetch session requests".

**Symptoms**:
1. Sidebar profile image and name were inconsistent when navigating to session-request page
2. Profile would appear to change when clicking on different dashboard sidebar items
3. Console errors about failed API requests

## Root Cause Analysis

### Issue 1: Missing `initialUserProfile` Prop
The session-request page was a **client component only**, which meant:
- It couldn't fetch the user profile server-side
- The `DashboardSidebar` component wasn't receiving the `initialUserProfile` prop
- Sidebar had to fetch profile data on every navigation, causing:
  - Race conditions
  - Flickering
  - Inconsistent state
  - Unnecessary API calls

### Issue 2: Client-Side Only Architecture
The original implementation was purely client-side:
- All data fetching happened in `useEffect` hooks
- No server-side authentication/authorization checks
- Profile data was fetched independently by sidebar on mount

## Solution Implemented

### Pattern: Server Component Wrapper + Client Component

We converted the page to follow the same pattern as other dashboard pages (like `/dashboard/page.tsx`):

1. **Server Component** (`page.tsx`) - Handles:
   - Server-side authentication
   - Role verification (DIETITIAN check)
   - Account status verification
   - User profile data fetching
   - Passes data to client component via props

2. **Client Component** (`SessionRequestClient.tsx`) - Handles:
   - Client-side state management
   - User interactions (modals, buttons)
   - API calls for session requests
   - Receives `initialUserProfile` and passes it to sidebar

---

## Code Changes

### BEFORE: Original Implementation (Client Component Only)

**File**: `app/dashboard/session-request/page.tsx` (OLD)

```tsx
"use client";

export default function SessionRequestPage() {
  // ... state management ...
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <DashboardSidebar /> {/* ❌ No initialUserProfile prop */}
      <main>...</main>
    </div>
  );
}
```

**Problems**:
- ❌ No server-side authentication
- ❌ No `initialUserProfile` passed to sidebar
- ❌ Sidebar must fetch profile independently
- ❌ Race conditions on navigation

---

### AFTER: New Implementation (Server + Client Components)

#### 1. Server Component Wrapper

**File**: `app/dashboard/session-request/page.tsx` (NEW)

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import SessionRequestClient from "./SessionRequestClient";

export default async function SessionRequestPage() {
  try {
    // 1. Server-side authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/dietitian-login?redirect=/dashboard/session-request");
    }

    // 2. Fetch user data and verify role
    const supabaseAdmin = createAdminClientServer();
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role, account_status, name, image")
      .eq("id", user.id)
      .single();

    if (userError || !dbUser) {
      redirect("/dietitian-enrollment");
    }

    if (dbUser.role !== "DIETITIAN") {
      // Redirect based on role
      if (dbUser.role === "USER") redirect("/user-dashboard");
      else if (dbUser.role === "ADMIN") redirect("/admin");
      else redirect("/");
    }

    if (dbUser.account_status !== "ACTIVE") {
      redirect("/account-status");
    }

    // 3. Prepare profile data and pass to client component
    const userProfile = {
      name: dbUser.name || null,
      image: dbUser.image || null,
    };

    return <SessionRequestClient initialUserProfile={userProfile} />;
  } catch (error) {
    console.error("Session Request: Server error", error);
    redirect("/dietitian-login?redirect=/dashboard/session-request");
  }
}
```

**Benefits**:
- ✅ Server-side authentication before render
- ✅ Role verification at server level
- ✅ Profile data fetched once on server
- ✅ Passed directly to client component

---

#### 2. Client Component (Receives Props)

**File**: `app/dashboard/session-request/SessionRequestClient.tsx` (NEW)

```tsx
"use client";

interface SessionRequestClientProps {
  initialUserProfile?: { name: string; image: string | null } | null;
}

export default function SessionRequestClient({ initialUserProfile }: SessionRequestClientProps) {
  const [requests, setRequests] = useState<SessionRequest[]>([]);
  // ... other state ...

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <DashboardSidebar initialUserProfile={initialUserProfile} /> {/* ✅ Receives prop */}
      <main>...</main>
    </div>
  );
}
```

**Benefits**:
- ✅ Receives profile data as prop (no fetching needed)
- ✅ Focuses on client-side interactions only
- ✅ Consistent with other dashboard pages

---

### 3. Sidebar Component (Already Had Support)

**File**: `components/layout/dashboard-sidebar.tsx`

The sidebar already had logic to handle `initialUserProfile`, but it wasn't being used:

```tsx
interface DashboardSidebarProps {
  initialUserProfile?: { name: string; image: string | null } | null;
}

export function DashboardSidebar({ initialUserProfile }: DashboardSidebarProps) {
  // Initialize from prop or sessionStorage
  const [userProfile, setUserProfile] = useState<{ name: string; image: string | null } | null>(() => {
    if (initialUserProfile) return initialUserProfile; // ✅ Uses prop if provided
    // ... fallback to sessionStorage ...
  });

  // Set profile immediately if provided via props
  useEffect(() => {
    if (initialUserProfile) {
      setUserProfile(initialUserProfile);
    }
  }, [initialUserProfile]);

  // Only fetch if no prop provided and not already fetched
  useEffect(() => {
    if (initialUserProfile || hasFetched) {
      return; // ✅ Skip fetch if prop provided
    }
    // ... fetch logic ...
  }, [initialUserProfile, hasFetched]);
}
```

**Key Logic**:
- ✅ Prioritizes `initialUserProfile` prop over fetching
- ✅ Uses `sessionStorage` as fallback for navigation
- ✅ Only fetches if no prop and not already fetched
- ✅ Prevents unnecessary re-fetches on navigation

---

## API Error Handling Improvements

### Before: Generic Error Handling

```tsx
if (!response.ok) {
  throw new Error("Failed to fetch session requests"); // ❌ Not helpful
}
```

### After: Detailed Error Handling

**File**: `app/dashboard/session-request/SessionRequestClient.tsx`

```tsx
if (!response.ok) {
  // Try to parse error response
  let errorMessage = "Failed to fetch session requests";
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorData.details || errorMessage;
  } catch (parseError) {
    errorMessage = response.statusText || errorMessage;
  }
  
  console.error("Session request API error:", {
    status: response.status,
    statusText: response.statusText,
    errorMessage,
  });
  
  // Handle authentication errors
  if (response.status === 401 || response.status === 403) {
    window.location.href = "/dietitian-login?redirect=/dashboard/session-request";
    return;
  }
  
  throw new Error(errorMessage);
}
```

---

## API Route Error Handling

**File**: `app/api/session-request/route.ts`

```tsx
export async function GET(request: NextRequest) {
  try {
    let dietitian;
    try {
      dietitian = await requireDietitianFromRequest(request);
    } catch (authError: any) {
      // ✅ Proper error handling with status codes
      const statusCode = authError?.status || (authError?.message?.includes("Unauthorized") ? 401 : 403);
      return NextResponse.json(
        { 
          error: authError?.message || "Authentication failed",
          details: authError?.message 
        },
        { status: statusCode }
      );
    }
    // ... rest of logic ...
  }
}
```

---

## Key Takeaways

1. **Pattern Consistency**: All dashboard pages now follow the same pattern (server component wrapper + client component)

2. **Performance**: Profile data is fetched once on the server, preventing:
   - Multiple client-side fetches
   - Race conditions
   - Flickering UI

3. **Security**: Server-side authentication ensures unauthorized users never reach the client component

4. **User Experience**: Sidebar profile remains consistent across all dashboard pages

5. **Error Handling**: Both client and server now have proper error handling with clear messages

---

## Testing Checklist

- [x] Navigate to `/dashboard/session-request` - sidebar profile should appear immediately
- [x] Navigate between dashboard pages - profile should remain consistent
- [x] Check console for errors - should be clean
- [x] Test with non-dietitian user - should redirect appropriately
- [x] Test with unauthenticated user - should redirect to login
- [x] Test API error scenarios - should show helpful error messages

---

## Related Files Modified

1. `app/dashboard/session-request/page.tsx` - Converted to server component
2. `app/dashboard/session-request/SessionRequestClient.tsx` - Created client component
3. `components/layout/dashboard-sidebar.tsx` - Already had support, just needed prop passed
4. `app/api/session-request/route.ts` - Enhanced error handling (already done previously)

---

## Related Pattern Examples

This same pattern is used in:
- `app/dashboard/page.tsx` → `app/dashboard/DashboardClient.tsx`
- `app/dashboard/meal-plan/page.tsx` → `app/dashboard/meal-plan/MealPlanClient.tsx`
- `app/dashboard/bookings/*/page.tsx` → `app/dashboard/bookings/BookingsPageClient.tsx`

All follow: **Server Component (auth + data) → Client Component (interactions)**

