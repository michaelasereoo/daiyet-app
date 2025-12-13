import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

// GET: List all active dietitians
export async function GET(request: NextRequest) {
  try {
    // Ensure user is authenticated (can be any role to view dietitians)
    try {
      await getCurrentUserFromRequest(request);
    } catch (authError) {
      // Log but don't block - allow unauthenticated users to view dietitians
      console.log("Auth check failed, proceeding anyway:", authError);
    }

    const supabaseAdmin = createAdminClientServer();

    // Fetch all active dietitians (or all dietitians if account_status is not set)
    const { data: dietitians, error } = await supabaseAdmin
      .from("users")
      .select(`
        id,
        name,
        email,
        bio,
        image,
        role,
        account_status
      `)
      .eq("role", "DIETITIAN")
      .or("account_status.eq.ACTIVE,account_status.is.null") // Include ACTIVE or null account_status
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching dietitians:", error);
      return NextResponse.json(
        { error: "Failed to fetch dietitians", details: error.message },
        { status: 500 }
      );
    }

    // Format the response
    const formattedDietitians = (dietitians || []).map((dietitian: any) => ({
      id: dietitian.id,
      name: dietitian.name || "Dietitian",
      email: dietitian.email,
      bio: dietitian.bio || "",
      image: dietitian.image,
      qualification: "Licensed Dietitian", // Could be stored in a separate table
      description: dietitian.bio || "Professional nutritionist ready to help you achieve your health goals.",
    }));

    return NextResponse.json({ dietitians: formattedDietitians });
  } catch (error: any) {
    console.error("Error fetching dietitians:", error);
    return NextResponse.json(
      { error: "Failed to fetch dietitians", details: error.message },
      { status: 500 }
    );
  }
}

