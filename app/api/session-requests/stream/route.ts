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

  // Fetch meal plan data for MEAL_PLAN requests (similar to user endpoint)
  const requestsWithMealPlans = await Promise.all(
    (requests || []).map(async (req: any) => {
      const result: any = { ...req };

      // For meal plan requests, check if meal plan has been sent (has PDF)
      if (req.request_type === "MEAL_PLAN") {
        try {
          console.log(`[STREAM CRITICAL] Processing meal plan request ID: ${req.id}`, {
            requestType: req.request_type,
            status: req.status,
            mealPlanType: req.meal_plan_type,
            clientEmail: req.client_email,
            dietitianId: dietitianId,
          });
          
          // First try to find by session_request_id
          // Use .limit(1) and get first result instead of .maybeSingle() to handle multiple results
          let { data: mealPlans, error: mealPlanError } = await supabaseAdmin
            .from("meal_plans")
            .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id, package_name, file_name, created_at")
            .eq("session_request_id", req.id)
            .order("created_at", { ascending: false })
            .limit(1);
          
          let mealPlan = mealPlans && mealPlans.length > 0 ? mealPlans[0] : null;
          
          console.log(`[STREAM CRITICAL] Direct query result for request ${req.id}:`, {
            found: !!mealPlan,
            mealPlanId: mealPlan?.id || null,
            sessionRequestId: mealPlan?.session_request_id || null,
            hasFileUrl: !!mealPlan?.file_url,
            fileUrl: mealPlan?.file_url || null,
            totalResults: mealPlans?.length || 0,
            error: mealPlanError?.message || null,
          });
          
          // If not found, try alternative queries regardless of status
          // This is critical because meal plans might exist before the request is approved
          if (!mealPlan && !mealPlanError) {
            console.log(`[STREAM CRITICAL] Meal plan not found directly for request ${req.id}, trying alternative queries...`);
            
            // Get user ID from email
            const { data: user, error: userError } = await supabaseAdmin
              .from("users")
              .select("id, email, name")
              .eq("email", req.client_email?.toLowerCase().trim())
              .maybeSingle();
            
            console.log(`[STREAM CRITICAL] User lookup for email ${req.client_email}:`, {
              found: !!user,
              userId: user?.id || null,
              userName: user?.name || null,
              error: userError?.message || null,
            });
            
            let altMealPlan: any = null;
            let altError: any = null;
            
            if (user) {
              // Try multiple strategies to find the meal plan:
              // 1. By dietitian_id, user_id, and package_name (exact match)
              let { data: foundMealPlan, error: foundError } = await supabaseAdmin
                .from("meal_plans")
                .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id, package_name, created_at, file_name")
                .eq("dietitian_id", dietitianId)
                .eq("user_id", user.id)
                .eq("package_name", req.meal_plan_type || "")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              
              console.log(`[STREAM CRITICAL] Exact match query result:`, {
                found: !!foundMealPlan,
                mealPlanId: foundMealPlan?.id || null,
                error: foundError?.message || null,
                packageName: foundMealPlan?.package_name || null,
                expectedPackage: req.meal_plan_type || null,
              });
              
              if (foundMealPlan && !foundError) {
                altMealPlan = foundMealPlan;
                altError = null;
                console.log(`[STREAM CRITICAL] Found meal plan via exact match:`, altMealPlan.id);
              }
              
              // 2. If not found, try by dietitian_id and user_id only (more flexible)
              if (!altMealPlan && !altError) {
                console.log(`[STREAM CRITICAL] Trying broader search for meal plan (dietitian + user only)...`);
                const { data: broaderMealPlan, error: broaderError } = await supabaseAdmin
                  .from("meal_plans")
                  .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id, package_name, created_at, file_name")
                  .eq("dietitian_id", dietitianId)
                  .eq("user_id", user.id)
                  .is("session_request_id", null) // Only get unlinked meal plans
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                console.log(`[STREAM CRITICAL] Broader match query result:`, {
                  found: !!broaderMealPlan,
                  mealPlanId: broaderMealPlan?.id || null,
                  error: broaderError?.message || null,
                });
                
                if (broaderMealPlan && !broaderError) {
                  altMealPlan = broaderMealPlan;
                  altError = null;
                  console.log(`[STREAM CRITICAL] Found meal plan via broader match:`, altMealPlan.id);
                }
              }
            }
            
            // 3. Last resort: Most recent unlinked meal plan by this dietitian
            // (handles data inconsistency where user emails don't match or user not found)
            if (!altMealPlan && !altError) {
              console.log(`[STREAM CRITICAL] Trying last resort search (most recent unlinked meal plan by dietitian)...`);
              const { data: recentMealPlan, error: recentError } = await supabaseAdmin
                .from("meal_plans")
                .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id, package_name, created_at, file_name")
                .eq("dietitian_id", dietitianId)
                .is("session_request_id", null) // Only get unlinked meal plans
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              
              console.log(`[STREAM CRITICAL] Last resort query result:`, {
                found: !!recentMealPlan,
                mealPlanId: recentMealPlan?.id || null,
                error: recentError?.message || null,
              });
              
              if (recentMealPlan && !recentError) {
                console.log(`[STREAM CRITICAL] Found unlinked meal plan via last resort search:`, {
                  id: recentMealPlan.id,
                  user_id: recentMealPlan.user_id,
                  expected_user_email: req.client_email,
                  package_name: recentMealPlan.package_name,
                  created_at: recentMealPlan.created_at,
                  hasFileUrl: !!recentMealPlan.file_url,
                });
                altMealPlan = recentMealPlan;
                altError = null;
              }
            }
            
            if (altMealPlan && !altError) {
              console.log(`[STREAM CRITICAL] Found meal plan via alternative query:`, {
                id: altMealPlan.id,
                session_request_id: altMealPlan.session_request_id,
                expected_session_request_id: req.id,
                matches: altMealPlan.session_request_id === req.id,
                package_name: altMealPlan.package_name,
                expected_package: req.meal_plan_type,
                file_url: altMealPlan.file_url,
                hasFileUrl: !!altMealPlan.file_url,
              });
              
              // If the meal plan has a null session_request_id, update it to link to this request
              if (!altMealPlan.session_request_id) {
                console.log(`[STREAM CRITICAL] Meal plan has null session_request_id, updating to link to request ${req.id}`);
                const { error: updateError } = await supabaseAdmin
                  .from("meal_plans")
                  .update({ session_request_id: req.id })
                  .eq("id", altMealPlan.id);
                
                if (updateError) {
                  console.error(`[STREAM CRITICAL] Error updating meal plan session_request_id:`, updateError);
                } else {
                  console.log(`[STREAM CRITICAL] Successfully linked meal plan ${altMealPlan.id} to request ${req.id}`);
                  altMealPlan.session_request_id = req.id;
                }
              }
              
              mealPlan = altMealPlan;
              mealPlanError = null;
            } else {
              console.warn(`[STREAM CRITICAL] Alternative queries found no meal plan for request ${req.id}`, {
                clientEmail: req.client_email,
                userId: user?.id || null,
                mealPlanType: req.meal_plan_type,
                error: altError?.message,
                userFound: !!user,
                status: req.status,
              });
            }
          }
          
          if (mealPlanError) {
            console.error(`[STREAM CRITICAL] Error fetching meal plan for request ${req.id}:`, {
              error: mealPlanError,
              code: mealPlanError.code,
              message: mealPlanError.message,
            });
            result.mealPlan = null;
          } else if (mealPlan) {
            console.log(`[STREAM CRITICAL] ✅ Found meal plan for request ${req.id}:`, {
              id: mealPlan.id,
              session_request_id: mealPlan.session_request_id,
              file_url: mealPlan.file_url,
              hasFileUrl: !!mealPlan.file_url,
              fileUrlLength: mealPlan.file_url?.length || 0,
              status: mealPlan.status,
              package_name: mealPlan.package_name,
            });
            const mealPlanData = {
              id: mealPlan.id,
              fileUrl: mealPlan.file_url,
              status: mealPlan.status,
              sentAt: mealPlan.sent_at,
              hasPdf: !!(mealPlan.file_url && mealPlan.file_url.trim() !== ''),
            };
            result.mealPlan = mealPlanData;
            console.log(`[STREAM CRITICAL] ✅ Set result.mealPlan for request ${req.id}:`, mealPlanData);
          } else {
            console.warn(`[STREAM CRITICAL] ⚠️ No meal plan found for request ${req.id} (status: ${req.status})`);
            result.mealPlan = null;
          }
        } catch (err) {
          console.error(`[STREAM] Exception fetching meal plan for request ${req.id}:`, err);
          result.mealPlan = null;
        }
      }

      return result;
    })
  );

  // Debug: Log meal plans before formatting
  console.log(`[STREAM] Requests with meal plans (before formatting):`, 
    (requestsWithMealPlans || []).map((r: any) => ({
      id: r.id,
      request_type: r.request_type,
      hasMealPlan: !!r.mealPlan,
      mealPlan: r.mealPlan ? { id: r.mealPlan.id, hasFileUrl: !!r.mealPlan.fileUrl } : null,
    }))
  );

  // Format the data
  return (requestsWithMealPlans || []).map((req: any) => {
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
      // Always include mealPlan data (even if null) so frontend knows the state
      request.mealPlan = req.mealPlan || null;
      console.log(`[STREAM] Formatting meal plan request ${req.id}:`, {
        hasMealPlanInReq: !!req.mealPlan,
        mealPlan: req.mealPlan ? { id: req.mealPlan.id, hasFileUrl: !!req.mealPlan.fileUrl } : null,
        finalMealPlan: request.mealPlan ? { id: request.mealPlan.id, hasFileUrl: !!request.mealPlan.fileUrl } : null,
      });
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
    // Authenticate user - use more lenient auth in dev mode
    let dietitian;
    try {
      dietitian = await requireDietitianFromRequest(request);
    } catch (authError: any) {
      // In dev mode, try to get dev user
      if (process.env.NODE_ENV === 'development') {
        const { getCurrentUserFromRequest } = await import("@/lib/auth-helpers");
        const devUser = await getCurrentUserFromRequest(request);
        if (devUser && devUser.role === 'DIETITIAN') {
          dietitian = devUser;
        } else {
          throw authError;
        }
      } else {
        throw authError;
      }
    }
    
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

        // Set up database listeners for both session_requests and meal_plans
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
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "meal_plans",
            },
            async (payload) => {
              try {
                // When a meal plan is created/updated, refresh all requests to get updated meal plan data
                const updatedRequests = await fetchSessionRequests(dietitianId);
                controller.enqueue(
                  `data: ${JSON.stringify({ type: "update", data: updatedRequests })}\n\n`
                );
              } catch (error) {
                console.error("Error handling meal plan change:", error);
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

