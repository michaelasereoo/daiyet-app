import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Fetch all out-of-office periods for authenticated dietitian
export async function GET(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();

    const { data: oooPeriods, error } = await supabaseAdmin
      .from("out_of_office_periods")
      .select("*")
      .eq("dietitian_id", dietitianId)
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Error fetching OOO periods:", error);
      return NextResponse.json(
        { error: "Failed to fetch out-of-office periods", details: error.message },
        { status: 500 }
      );
    }

    const formattedPeriods = (oooPeriods || []).map((period: any) => ({
      id: period.id,
      startDate: period.start_date,
      endDate: period.end_date,
      reason: period.reason || "Unspecified",
      notes: period.notes || "",
      forwardToTeam: period.forward_to_team || false,
      forwardUrl: period.forward_url || null,
      createdAt: period.created_at,
      updatedAt: period.updated_at,
    }));

    return NextResponse.json({ periods: formattedPeriods });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching out-of-office periods:", error);
    return NextResponse.json(
      { error: "Failed to fetch out-of-office periods", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create new out-of-office period
export async function POST(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const body = await request.json();
    const { startDate, endDate, reason, notes, forwardToTeam, forwardUrl } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Validate date range
    const start = typeof startDate === "string" ? startDate : new Date(startDate).toISOString().split("T")[0];
    const end = typeof endDate === "string" ? endDate : new Date(endDate).toISOString().split("T")[0];

    if (start > end) {
      return NextResponse.json(
        { error: "startDate must be before or equal to endDate" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    const { data: oooPeriod, error } = await supabaseAdmin
      .from("out_of_office_periods")
      .insert({
        dietitian_id: dietitianId,
        start_date: start,
        end_date: end,
        reason: reason || "Unspecified",
        notes: notes || "",
        forward_to_team: forwardToTeam || false,
        forward_url: forwardUrl || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating OOO period:", error);
      return NextResponse.json(
        { error: "Failed to create out-of-office period", details: error.message },
        { status: 500 }
      );
    }

    const formattedPeriod = {
      id: oooPeriod.id,
      startDate: oooPeriod.start_date,
      endDate: oooPeriod.end_date,
      reason: oooPeriod.reason || "Unspecified",
      notes: oooPeriod.notes || "",
      forwardToTeam: oooPeriod.forward_to_team || false,
      forwardUrl: oooPeriod.forward_url || null,
      createdAt: oooPeriod.created_at,
      updatedAt: oooPeriod.updated_at,
    };

    return NextResponse.json({ period: formattedPeriod });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error creating out-of-office period:", error);
    return NextResponse.json(
      { error: "Failed to create out-of-office period", details: error.message },
      { status: 500 }
    );
  }
}

