import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export async function GET(request: NextRequest) {
  try {
    const dateStr = request.nextUrl.searchParams.get("date") || "2024-12-23";
    const timezoneStr = request.nextUrl.searchParams.get("timezone") || "Africa/Lagos";
    
    const dateObj = new Date(dateStr);
    const dayjsTz = dayjs.tz(dateStr, timezoneStr);
    
    return NextResponse.json({
      success: true,
      date: dateStr,
      timezone: timezoneStr,
      tests: {
        "new Date()": {
          day: dateObj.getDay(),
          iso: dateObj.toISOString()
        },
        "dayjs.tz()": {
          day: dayjsTz.day(),
          iso: dayjsTz.toISOString(),
          format: dayjsTz.format()
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
    console.error("Timezone endpoint error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error?.message || "Unknown error",
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

