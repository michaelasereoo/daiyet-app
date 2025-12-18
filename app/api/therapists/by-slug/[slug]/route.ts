import { NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";

/**
 * Convert a URL slug back to a searchable name pattern
 * e.g., "john-doe" -> searches for names containing "john" and "doe"
 */
function slugToNameParts(slug: string): string[] {
  if (!slug) return [];
  return slug
    .toLowerCase()
    .split("-")
    .filter(part => part.length > 0);
}

/**
 * Convert a name to a URL slug for comparison
 */
function nameToSlug(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js 15+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { slug } = resolvedParams;
    
    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClientServer();
    
    // First, try to find an exact match by converting slug back to name pattern
    // This searches for therapists whose name, when slugified, matches the slug
    const { data: therapists, error } = await supabase
      .from("users")
      .select(`
        id,
        name,
        email,
        bio,
        image,
        metadata,
        role,
        updated_at
      `)
      .eq("role", "THERAPIST")
      .or("account_status.eq.ACTIVE,account_status.is.null");

    if (error) {
      console.error("Error fetching therapists:", error);
      return NextResponse.json(
        { error: "Failed to fetch therapists" },
        { status: 500 }
      );
    }

    // Find the therapist whose name matches the slug
    const matchedTherapist = therapists?.find(t => {
      const therapistSlug = nameToSlug(t.name || "");
      return therapistSlug === slug.toLowerCase();
    });

    if (!matchedTherapist) {
      // Try a more lenient search - match if all slug parts are in the name
      const slugParts = slugToNameParts(slug);
      const fuzzyMatch = therapists?.find(t => {
        const nameLower = (t.name || "").toLowerCase();
        return slugParts.every(part => nameLower.includes(part));
      });

      if (!fuzzyMatch) {
        return NextResponse.json(
          { error: "Therapist not found" },
          { status: 404 }
        );
      }

      // Transform the fuzzy matched result
      return NextResponse.json({
        therapist: {
          id: fuzzyMatch.id,
          name: fuzzyMatch.name || "Therapist",
          email: fuzzyMatch.email || "",
          bio: fuzzyMatch.bio || "",
          image: fuzzyMatch.image || "",
          specialization: fuzzyMatch.metadata?.specialization || "",
          licenseNumber: fuzzyMatch.metadata?.licenseNumber || "",
          experience: fuzzyMatch.metadata?.experience || "",
          location: fuzzyMatch.metadata?.location || "",
          qualifications: fuzzyMatch.metadata?.qualifications || [],
          updatedAt: fuzzyMatch.updated_at,
        },
        slug: nameToSlug(fuzzyMatch.name || ""),
      });
    }

    // Transform to response format
    return NextResponse.json({
      therapist: {
        id: matchedTherapist.id,
        name: matchedTherapist.name || "Therapist",
        email: matchedTherapist.email || "",
        bio: matchedTherapist.bio || "",
        image: matchedTherapist.image || "",
        specialization: matchedTherapist.metadata?.specialization || "",
        licenseNumber: matchedTherapist.metadata?.licenseNumber || "",
        experience: matchedTherapist.metadata?.experience || "",
        location: matchedTherapist.metadata?.location || "",
        qualifications: matchedTherapist.metadata?.qualifications || [],
        updatedAt: matchedTherapist.updated_at,
      },
      slug: nameToSlug(matchedTherapist.name || ""),
    });
  } catch (error) {
    console.error("Error in therapist lookup by slug:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

