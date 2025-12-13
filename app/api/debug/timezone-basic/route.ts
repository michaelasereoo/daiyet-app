import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const dateStr = request.nextUrl.searchParams.get("date") || "2024-12-23";
    const dateObj = new Date(dateStr);
    
    return NextResponse.json({
      success: true,
      date: dateStr,
      test: {
        "new Date()": {
          day: dateObj.getDay(),
          iso: dateObj.toISOString(),
          toString: dateObj.toString()
        }
      },
      dayMapping: {
        0: "Sunday",
        1: "Monday",
        2: "Tuesday",
        3: "Wednesday",
        4: "Thursday",
        5: "Friday",
        6: "Saturday"
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}

