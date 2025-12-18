import { NextRequest } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

// Helper function to fetch meal plans
async function fetchMealPlans(userId: string, role: "USER" | "DIETITIAN" | "THERAPIST") {
  const supabaseAdmin = createAdminClientServer();
  
  let query = supabaseAdmin
    .from("meal_plans")
    .select(`
      id,
      session_request_id,
      dietitian_id,
      user_id,
      package_name,
      file_url,
      file_name,
      status,
      sent_at,
      created_at,
      updated_at,
      users!meal_plans_user_id_fkey (
        id,
        name,
        email
      ),
      dietitians:users!meal_plans_dietitian_id_fkey (
        id,
        name,
        email
      )
    `)
    .order("created_at", { ascending: false });

  if (role === "USER") {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("dietitian_id", userId);
  }

  const { data: mealPlans, error } = await query;

  if (error) {
    console.error("Error fetching meal plans:", error);
    return [];
  }

  // Format the data
  return (mealPlans || []).map((plan: any) => ({
    id: plan.id,
    sessionRequestId: plan.session_request_id,
    userId: plan.user_id,
    dietitianId: plan.dietitian_id,
    userName: plan.users?.name || "Unknown",
    userEmail: plan.users?.email || "Unknown",
    dietitianName: plan.dietitians?.name || "Unknown",
    dietitianEmail: plan.dietitians?.email || "Unknown",
    packageName: plan.package_name,
    fileUrl: plan.file_url,
    fileName: plan.file_name,
    status: plan.status,
    sentAt: plan.sent_at,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  }));
}

// GET: SSE endpoint for meal plans
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createAdminClientServer();
    
    // Get user role
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = ((dbUser?.role === "DIETITIAN" || dbUser?.role === "THERAPIST") ? (dbUser.role as "DIETITIAN" | "THERAPIST") : "USER") as "USER" | "DIETITIAN" | "THERAPIST";

    // Set SSE headers
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial data
        try {
          const initialMealPlans = await fetchMealPlans(user.id, role);
          controller.enqueue(
            `data: ${JSON.stringify({ type: "initial", data: initialMealPlans })}\n\n`
          );
        } catch (error) {
          console.error("Error sending initial data:", error);
          controller.enqueue(
            `data: ${JSON.stringify({ type: "error", error: "Failed to fetch initial data" })}\n\n`
          );
        }

        // Set up database listener
        const filter = role === "USER" 
          ? `user_id=eq.${user.id}`
          : `dietitian_id=eq.${user.id}`;

        const channel = supabaseAdmin
          .channel(`meal-plans-stream:${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "meal_plans",
              filter: filter,
            },
            async (payload) => {
              try {
                // Fetch fresh data to ensure consistency
                const updatedMealPlans = await fetchMealPlans(user.id, role);
                controller.enqueue(
                  `data: ${JSON.stringify({ type: "update", data: updatedMealPlans })}\n\n`
                );
              } catch (error) {
                console.error("Error handling database change:", error);
              }
            }
          )
          .subscribe();

        // Keep connection alive
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(": keepalive\n\n");
          } catch (error) {
            // Connection closed
            clearInterval(keepAlive);
            supabaseAdmin.removeChannel(channel);
          }
        }, 30000);

        // Cleanup on disconnect
        request.signal.addEventListener("abort", () => {
          clearInterval(keepAlive);
          supabaseAdmin.removeChannel(channel);
          try {
            controller.close();
          } catch (error) {
            // Already closed
          }
        });
      },
    });

    return new Response(stream, { headers });
  } catch (error: any) {
    console.error("Error in SSE stream:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create stream", details: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

