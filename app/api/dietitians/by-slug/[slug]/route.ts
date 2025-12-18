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
    // This searches for dietitians whose name, when slugified, matches the slug
    const { data: dietitians, error } = await supabase
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
      .eq("role", "DIETITIAN")
      .or("account_status.eq.ACTIVE,account_status.is.null");

    if (error) {
      console.error("Error fetching dietitians:", error);
      return NextResponse.json(
        { error: "Failed to fetch dietitians" },
        { status: 500 }
      );
    }

    // Find the dietitian whose name matches the slug
    const matchedDietitian = dietitians?.find(d => {
      const dietitianSlug = nameToSlug(d.name || "");
      return dietitianSlug === slug.toLowerCase();
    });

    if (!matchedDietitian) {
      // Try a more lenient search - match if all slug parts are in the name
      const slugParts = slugToNameParts(slug);
      const fuzzyMatch = dietitians?.find(d => {
        const nameLower = (d.name || "").toLowerCase();
        return slugParts.every(part => nameLower.includes(part));
      });

      if (!fuzzyMatch) {
        return NextResponse.json(
          { error: "Dietitian not found" },
          { status: 404 }
        );
      }

      // Transform the fuzzy matched result
      return NextResponse.json({
        dietitian: {
          id: fuzzyMatch.id,
          name: fuzzyMatch.name || "Dietitian",
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
      dietitian: {
        id: matchedDietitian.id,
        name: matchedDietitian.name || "Dietitian",
        email: matchedDietitian.email || "",
        bio: matchedDietitian.bio || "",
        image: matchedDietitian.image || "",
        specialization: matchedDietitian.metadata?.specialization || "",
        licenseNumber: matchedDietitian.metadata?.licenseNumber || "",
        experience: matchedDietitian.metadata?.experience || "",
        location: matchedDietitian.metadata?.location || "",
        qualifications: matchedDietitian.metadata?.qualifications || [],
        updatedAt: matchedDietitian.updated_at,
      },
      slug: nameToSlug(matchedDietitian.name || ""),
    });
  } catch (error) {
    console.error("Error in dietitian lookup by slug:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
