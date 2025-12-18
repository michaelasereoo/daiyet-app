import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// POST: Upload meal plan PDF file
export async function POST(request: NextRequest) {
  try {
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

    const formData = await request.formData();
    const file = formData.get("file") as File;

    console.log("[UPLOAD] Received upload request", {
      dietitianId,
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
    });

    if (!file) {
      console.error("[UPLOAD] No file provided");
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    // Validate file type - be more lenient with PDF detection
    const isValidPdf = file.type === "application/pdf" || 
                       file.name.toLowerCase().endsWith('.pdf') ||
                       file.type === "";
    
    if (!isValidPdf) {
      console.error("[UPLOAD] Invalid file type", { fileType: file.type, fileName: file.name });
      return NextResponse.json(
        { error: "Only PDF files are allowed", details: `File type: ${file.type}` },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.error("[UPLOAD] File too large", { fileSize: file.size, maxSize });
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Convert file to buffer
    console.log("[UPLOAD] Converting file to buffer...");
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("[UPLOAD] Buffer created", { bufferSize: buffer.length });

    // Generate unique file name
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${dietitianId}/${timestamp}-${sanitizedFileName}`;
    console.log("[UPLOAD] Generated file name", { fileName });

    // Check if bucket exists and is accessible
    console.log("[UPLOAD] Checking storage bucket...");
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
    if (bucketError) {
      console.error("[UPLOAD] Error listing buckets:", bucketError);
    } else {
      const mealPlansBucket = buckets?.find(b => b.name === "meal-plans");
      console.log("[UPLOAD] Bucket check", { 
        bucketExists: !!mealPlansBucket,
        allBuckets: buckets?.map(b => b.name) 
      });
      
      if (!mealPlansBucket) {
        console.error("[UPLOAD] 'meal-plans' bucket does not exist!");
        return NextResponse.json(
          { 
            error: "Storage bucket not found", 
            details: "The 'meal-plans' storage bucket does not exist. Please create it in Supabase Storage.",
            buckets: buckets?.map(b => b.name) || []
          },
          { status: 500 }
        );
      }
    }

    // Upload to Supabase Storage
    console.log("[UPLOAD] Starting upload to Supabase Storage...");
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("meal-plans")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[UPLOAD] Upload error:", {
        error: uploadError,
        message: uploadError.message,
        statusCode: uploadError.statusCode,
        errorCode: uploadError.error,
      });
      return NextResponse.json(
        { 
          error: "Failed to upload file", 
          details: uploadError.message,
          errorCode: uploadError.error,
          statusCode: uploadError.statusCode,
        },
        { status: 500 }
      );
    }

    console.log("[UPLOAD] Upload successful", { uploadData });

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("meal-plans")
      .getPublicUrl(fileName);

    console.log("[UPLOAD] Generated public URL", { publicUrl: urlData.publicUrl });

    return NextResponse.json({
      fileUrl: urlData.publicUrl,
      fileName: file.name,
      storagePath: fileName,
    });
  } catch (error: any) {
    console.error("[UPLOAD] Unexpected error:", {
      error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to upload file", 
        details: error?.message || "Unknown error",
        errorType: error?.name,
      },
      { status: 500 }
    );
  }
}

