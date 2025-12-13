import { NextRequest } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

// Helper function to fetch bookings
async function fetchBookings(userId: string, role: "USER" | "DIETITIAN") {
  const supabaseAdmin = createAdminClientServer();
  
  let query = supabaseAdmin
    .from("bookings")
    .select(`
      id,
      title,
      description,
      start_time,
      end_time,
      status,
      meeting_link,
      event_type_id,
      user_id,
      dietitian_id,
      event_types (
        id,
        title,
        slug,
        length
      ),
      users!bookings_user_id_fkey (
        id,
        name,
        email
      ),
      dietitians:users!bookings_dietitian_id_fkey (
        id,
        name,
        email,
        bio,
        image
      )
    `)
    .order("start_time", { ascending: true });

  if (role === "USER") {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("dietitian_id", userId);
  }

  const { data: bookings, error } = await query;

  if (error) {
    console.error("Error fetching bookings:", error);
    return [];
  }

  // Format the data
  return (bookings || []).map((booking: any) => ({
    id: booking.id,
    title: booking.title,
    description: booking.description,
    date: new Date(booking.start_time),
    startTime: new Date(booking.start_time),
    endTime: new Date(booking.end_time),
    status: booking.status,
    meetingLink: booking.meeting_link,
    eventType: booking.event_types
      ? {
          id: booking.event_types.id,
          title: booking.event_types.title,
          slug: booking.event_types.slug,
          length: booking.event_types.length,
        }
      : null,
    user: booking.users
      ? {
          id: booking.users.id,
          name: booking.users.name,
          email: booking.users.email,
        }
      : null,
    dietitian: booking.dietitians
      ? {
          id: booking.dietitians.id,
          name: booking.dietitians.name,
          email: booking.dietitians.email,
          bio: booking.dietitians.bio,
          image: booking.dietitians.image,
        }
      : null,
    participants: role === "USER"
      ? ["You", booking.dietitians?.name || "Dietitian"]
      : [booking.users?.name || "User", "You"],
  }));
}

// GET: SSE endpoint for bookings
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

    const role = (dbUser?.role === "DIETITIAN" ? "DIETITIAN" : "USER") as "USER" | "DIETITIAN";

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
          const initialBookings = await fetchBookings(user.id, role);
          controller.enqueue(
            `data: ${JSON.stringify({ type: "initial", data: initialBookings })}\n\n`
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
          .channel(`bookings-stream:${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
              filter: filter,
            },
            async (payload) => {
              try {
                // Fetch fresh data to ensure consistency
                const updatedBookings = await fetchBookings(user.id, role);
                controller.enqueue(
                  `data: ${JSON.stringify({ type: "update", data: updatedBookings })}\n\n`
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

