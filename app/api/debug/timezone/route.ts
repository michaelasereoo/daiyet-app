import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export async function GET(request: NextRequest) {
  try {
    const dateStr = request.nextUrl.searchParams.get("date") || "2025-01-20"; // Monday in 2025
    const timezoneStr = request.nextUrl.searchParams.get("timezone") || "Africa/Lagos";
    
    const dateObj = new Date(dateStr);
    const dayjsTz = dayjs.tz(dateStr, timezoneStr);
    const dayjsWithTime = dayjs.tz(`${dateStr} 09:00:00`, timezoneStr);
    
    return NextResponse.json({
      success: true,
      date: dateStr,
      timezone: timezoneStr,
      tests: [
        {
          name: "new Date() with date string",
          code: 'new Date("2025-01-20")',
          day: dateObj.getDay(),
          iso: dateObj.toISOString(),
          local: dateObj.toLocaleString("en-US", { timeZone: timezoneStr })
        },
        {
          name: "dayjs with timezone",
          code: 'dayjs.tz("2025-01-20", "Africa/Lagos")',
          day: dayjsTz.day(),
          iso: dayjsTz.toISOString(),
          format: dayjsTz.format("YYYY-MM-DD HH:mm:ss")
        },
        {
          name: "dayjs with time and timezone",
          code: 'dayjs.tz("2025-01-20 09:00:00", "Africa/Lagos")',
          day: dayjsWithTime.day(),
          iso: dayjsWithTime.toISOString(),
          format: dayjsWithTime.format()
        },
        {
          name: "Current timezone info",
          serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          UTCoffset: new Date().getTimezoneOffset(),
          LagosOffset: dayjs().tz("Africa/Lagos").utcOffset(),
          serverOffset: dayjs().utcOffset()
        }
      ],
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
    console.error("❌ [DEBUG] Timezone endpoint error:", error);
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
