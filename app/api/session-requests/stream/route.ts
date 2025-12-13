import { NextRequest } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// Helper function to fetch session requests
async function fetchSessionRequests(dietitianId: string) {
  const supabaseAdmin = createAdminClientServer();
  
  const { data: requests, error } = await supabaseAdmin
    .from("session_requests")
    .select(`
      id,
      request_type,
      client_name,
      client_email,
      message,
      status,
      event_type_id,
      meal_plan_type,
      price,
      currency,
      requested_date,
      created_at,
      event_types (
        id,
        title,
        price,
        currency,
        length
      )
    `)
    .eq("dietitian_id", dietitianId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching session requests:", error);
    return [];
  }

  // Format the data
  return (requests || []).map((req: any) => {
    const request: any = {
      id: req.id,
      requestType: req.request_type,
      clientName: req.client_name,
      clientEmail: req.client_email,
      message: req.message,
      status: req.status,
      createdAt: req.created_at,
    };

    if (req.request_type === "CONSULTATION" && req.event_types) {
      request.eventType = {
        id: req.event_types.id,
        title: req.event_types.title,
      };
      request.price = req.event_types.price;
      request.currency = req.event_types.currency;
      request.duration = req.event_types.length;
    } else if (req.request_type === "MEAL_PLAN") {
      request.mealPlanType = req.meal_plan_type;
      request.price = req.price;
      request.currency = req.currency;
    }

    if (req.requested_date) {
      request.requestedDate = req.requested_date;
    }

    return request;
  });
}

// GET: SSE endpoint for session requests
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    // Set SSE headers
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // For nginx
    });

    const stream = new ReadableStream({
      async start(controller) {
        const supabaseAdmin = createAdminClientServer();

        // Send initial data
        try {
          const initialRequests = await fetchSessionRequests(dietitianId);
          controller.enqueue(
            `data: ${JSON.stringify({ type: "initial", data: initialRequests })}\n\n`
          );
        } catch (error) {
          console.error("Error sending initial data:", error);
          controller.enqueue(
            `data: ${JSON.stringify({ type: "error", error: "Failed to fetch initial data" })}\n\n`
          );
        }

        // Set up database listener
        const channel = supabaseAdmin
          .channel(`session-stream:${dietitianId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "session_requests",
              filter: `dietitian_id=eq.${dietitianId}`,
            },
            async (payload) => {
              try {
                // Fetch fresh data to ensure consistency
                const updatedRequests = await fetchSessionRequests(dietitianId);
                controller.enqueue(
                  `data: ${JSON.stringify({ type: "update", data: updatedRequests })}\n\n`
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
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: error.message === "Unauthorized" ? 401 : 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
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

