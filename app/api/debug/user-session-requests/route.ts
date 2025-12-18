import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientServer } from '@/lib/supabase/server';
import { requireAuthFromRequest } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userEmail = user.email;
    const normalizedEmail = userEmail.toLowerCase().trim();

    const supabaseAdmin = createAdminClientServer();
    
    // Get all session requests for this email (no status filter)
    const { data: allRequests, error } = await supabaseAdmin
      .from("session_requests")
      .select("*")
      .eq("client_email", normalizedEmail)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get pending requests
    const pendingRequests = allRequests?.filter(r => r.status === "PENDING" || r.status === "RESCHEDULE_REQUESTED") || [];

    // Check each pending request's event type
    const requestsWithDetails = await Promise.all(
      pendingRequests.map(async (req: any) => {
        const details: any = {
          id: req.id,
          request_type: req.request_type,
          status: req.status,
          client_email: req.client_email,
          event_type_id: req.event_type_id,
        };

        if (req.request_type === "CONSULTATION" && req.event_type_id) {
          const { data: eventType } = await supabaseAdmin
            .from("event_types")
            .select("id, title, slug, active, user_id")
            .eq("id", req.event_type_id)
            .single();

          details.eventType = eventType;
          details.eventTypeExists = !!eventType;
          details.eventTypeActive = eventType?.active;
          details.wouldBeSkipped = !eventType || !eventType.active;
        }

        return details;
      })
    );

    return NextResponse.json({
      userEmail,
      normalizedEmail,
      totalRequests: allRequests?.length || 0,
      pendingRequests: pendingRequests.length,
      requestsWithDetails,
      allRequests: allRequests?.map((r: any) => ({
        id: r.id,
        request_type: r.request_type,
        status: r.status,
        client_email: r.client_email,
        event_type_id: r.event_type_id,
        created_at: r.created_at,
      })) || [],
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

