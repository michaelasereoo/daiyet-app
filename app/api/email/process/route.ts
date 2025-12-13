import { NextRequest, NextResponse } from "next/server";
import { emailQueue } from "@/lib/email/queue";

// POST: Manually trigger email queue processing
export async function POST(request: NextRequest) {
  try {
    // Verify secret for security
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Process the queue
    await emailQueue.processQueuePublic();

    return NextResponse.json({ success: true, message: "Email queue processed" });
  } catch (error: any) {
    console.error("Error processing email queue:", error);
    return NextResponse.json(
      { error: "Failed to process email queue", details: error.message },
      { status: 500 }
    );
  }
}

