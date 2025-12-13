import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

// GET: Fetch user profile data
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    const { data: userProfile, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, age, occupation, medical_condition, monthly_food_budget")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: userProfile });
  } catch (error: any) {
    console.error("Error in profile GET route:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile", details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update user profile data
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { age, occupation, medical_condition, monthly_food_budget } = body;

    const supabaseAdmin = createAdminClientServer();

    const updateData: any = {};
    if (age !== undefined) updateData.age = age;
    if (occupation !== undefined) updateData.occupation = occupation;
    if (medical_condition !== undefined) updateData.medical_condition = medical_condition;
    if (monthly_food_budget !== undefined) updateData.monthly_food_budget = monthly_food_budget;

    const { data: updatedProfile, error } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating user profile:", error);
      return NextResponse.json(
        { error: "Failed to update profile", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: updatedProfile });
  } catch (error: any) {
    console.error("Error in profile PUT route:", error);
    return NextResponse.json(
      { error: "Failed to update profile", details: error.message },
      { status: 500 }
    );
  }
}

