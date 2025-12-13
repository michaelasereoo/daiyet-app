import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import DashboardClient, {
  type DashboardStats,
  type Booking,
} from "./DashboardClient";

export default async function DashboardPage() {
  try {
    const supabaseAdmin = createAdminClientServer();
    
    // 1. Check authentication (server-side) - Using getUser() which is more reliable than getSession()
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Dashboard: No user found", {
        error: authError?.message,
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      });
      redirect("/dietitian-login?redirect=/dashboard");
    }

    // 2. Check user role and account status
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("role, account_status, name, email, id")
      .eq("id", user.id)
      .single();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:29',message:'Database user fetch result',data:{hasError:!!userError,hasUser:!!dbUser,userId:user?.id,userEmail:user?.email,userRole:dbUser?.role},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (userError || !dbUser) {
      console.error("Dashboard: User not found in database", {
        error: userError?.message,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/dietitian-enrollment");
    }

    if (dbUser.role !== "DIETITIAN") {
      console.error("Dashboard: User is not dietitian", { 
        role: dbUser.role,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      // Redirect based on role
      if (dbUser.role === "USER") {
        redirect("/user-dashboard");
      } else if (dbUser.role === "ADMIN") {
        redirect("/admin");
      } else {
        redirect("/");
      }
    }

    if (dbUser.account_status !== "ACTIVE") {
      console.error("Dashboard: Account not active", {
        status: dbUser.account_status,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/account-status");
    }

    // Use the authenticated user's ID
    let dietitianId: string | null = dbUser.id;

    // 3. Fetch dashboard stats (server-side)
    const now = new Date().toISOString();

    // Get total sessions (completed bookings)
    // Use dietitian_id filter if we found the user
    const totalSessionsQuery = supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "COMPLETED");
    
    if (dietitianId) {
      totalSessionsQuery.eq("dietitian_id", dietitianId);
    }
    
    const { count: totalSessions } = await totalSessionsQuery;

    // Get upcoming sessions (future confirmed bookings)
    // Use dietitian_id filter if we found the user
    const upcomingSessionsQuery = supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "CONFIRMED")
      .gte("start_time", now);
    
    if (dietitianId) {
      upcomingSessionsQuery.eq("dietitian_id", dietitianId);
    }
    
    const { count: upcomingSessions } = await upcomingSessionsQuery;

    // Get total revenue (sum of successful payments)
    // Use dietitian_id filter if we found the user
    let paymentsQuery;
    if (dietitianId) {
      // If we have dietitian ID, filter payments by their bookings
      paymentsQuery = supabaseAdmin
        .from("payments")
        .select(
          `
          amount,
          bookings!inner(dietitian_id)
        `
        )
        .eq("status", "SUCCESS")
        .eq("bookings.dietitian_id", dietitianId);
    } else {
      // No dietitian ID, get all payments
      paymentsQuery = supabaseAdmin
        .from("payments")
        .select("amount")
        .eq("status", "SUCCESS");
    }
    
    const { data: payments, error: paymentsError } = await paymentsQuery;

    let totalRevenue = 0;
    if (!paymentsError && payments) {
      totalRevenue = payments.reduce((sum, payment) => {
        return sum + Number(payment.amount || 0);
      }, 0);
    }

    const stats: DashboardStats = {
      totalSessions: totalSessions || 0,
      upcomingSessions: upcomingSessions || 0,
      totalRevenue: totalRevenue,
    };

    // 4. Fetch upcoming bookings (server-side)
    const bookingsQuery = supabaseAdmin
      .from("bookings")
      .select(
        `
        id,
        start_time,
        end_time,
        title,
        description,
        meeting_link,
        event_types:event_type_id (
          title
        ),
        user:users!bookings_user_id_fkey (
          name,
          email
        )
      `
      )
      .eq("status", "CONFIRMED")
      .gte("start_time", now)
      .order("start_time", { ascending: true })
      .limit(5);
    
    // Add dietitian_id filter if we found the user
    if (dietitianId) {
      bookingsQuery.eq("dietitian_id", dietitianId);
    }
    
    const { data: bookingsData, error: bookingsError } = await bookingsQuery;

    // Transform bookings to match the expected format
    const upcomingBookings: Booking[] =
      bookingsData && !bookingsError
        ? bookingsData
            .filter((b: any) => {
              const startTime = new Date(b.start_time);
              return startTime > new Date(); // Only future bookings
            })
            .map((b: any) => ({
              id: b.id,
              date: new Date(b.start_time),
              startTime: new Date(b.start_time),
              endTime: new Date(b.end_time),
              title: b.title || b.event_types?.title || "Consultation",
              description: b.description || "",
              message: b.description,
              participants: [
                "You",
                b.user?.name || b.user?.email || "Client",
              ],
              meetingLink: b.meeting_link || undefined,
            }))
        : [];

    // 5. Pass data to client component
    // Profile is now managed by AuthProvider context via dashboard layout
    return (
      <DashboardClient 
        stats={stats} 
        upcomingBookings={upcomingBookings}
        userName={dbUser.name || undefined}
      />
    );
  } catch (error) {
    console.error("Dashboard: Server error", error);
    // TEMP: Don't redirect on error when auth is disabled
    // redirect("/dietitian-login?redirect=/dashboard");
    
    // Return empty dashboard on error
    return (
      <DashboardClient 
        stats={{ totalSessions: 0, upcomingSessions: 0, totalRevenue: 0 }} 
        upcomingBookings={[]} 
      />
    );
  }
}