import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";
import {
  calculateSlotsForDateRange,
  type AvailabilitySlot,
  type DateOverride,
  type OutOfOfficePeriod,
} from "@/lib/availability/calculate-timeslots";
import { TimezoneHelper } from "@/lib/utils/timezone";

// GET: Calculate available timeslots for a date range
// Now allows both authenticated users and dietitians to query any dietitian's availability
export async function GET(request: NextRequest) {
  console.log('🎯 [DEBUG] Timeslots API called with params:', {
    url: request.url,
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
    timestamp: new Date().toISOString()
  });

  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:14',message:'API call started',data:{url:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const durationMinutes = parseInt(searchParams.get("duration") || "30", 10);
    const targetDietitianId = searchParams.get("dietitianId");
    const eventTypeId = searchParams.get("eventTypeId");
    
    // dietitianId is required for this endpoint
    if (!targetDietitianId) {
      return NextResponse.json(
        { error: "dietitianId query parameter is required" },
        { status: 400 }
      );
    }
    
    // Allow unauthenticated users to query availability for booking
    // If authenticated, check if they're querying their own availability
    const currentUser = await getCurrentUserFromRequest(request);
    const dietitianId = ((currentUser?.role === "DIETITIAN" || currentUser?.role === "THERAPIST") && targetDietitianId === currentUser.id) 
      ? currentUser.id 
      : targetDietitianId;
    
    if (currentUser) {
      console.log('✅ [DEBUG] User authenticated:', {
        userId: currentUser.id,
        role: currentUser.role
      });
    } else {
      console.log('✅ [DEBUG] Unauthenticated request (public booking access)');
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:16',message:'Request processed',data:{userId:currentUser?.id,role:currentUser?.role,isAuthenticated:!!currentUser},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    console.log('📋 [DEBUG] Parsed parameters:', {
      startDateStr,
      endDateStr,
      durationMinutes,
      targetDietitianId,
      dietitianId,
      eventTypeId: eventTypeId || 'MISSING',
      userRole: currentUser?.role || 'unauthenticated'
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:22',message:'Query params extracted',data:{startDateStr,endDateStr,durationMinutes,targetDietitianId,dietitianId,eventTypeId:eventTypeId||'MISSING',userRole:currentUser?.role||'unauthenticated'},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Verify the target dietitian exists and is actually a dietitian
    const supabaseAdmin = createAdminClientServer();
    const { data: targetDietitian, error: dietitianError } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", dietitianId)
      .single();

    if (dietitianError || !targetDietitian || (targetDietitian.role !== "DIETITIAN" && targetDietitian.role !== "THERAPIST")) {
      return NextResponse.json(
        { error: "Dietitian/Therapist not found" },
        { status: 404 }
      );
    }

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: "startDate and endDate query parameters are required" },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: "startDate must be before or equal to endDate" },
        { status: 400 }
      );
    }

    // Determine which schedule to use
    let scheduleIdToUse: string | null = null;
    
    if (eventTypeId) {
      // Check if event type has a specific availability schedule
      const { data: eventType, error: eventTypeError } = await supabaseAdmin
        .from("event_types")
        .select("availability_schedule_id, user_id")
        .eq("id", eventTypeId)
        .single();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:64',message:'Event type query result',data:{eventTypeId,found:!!eventType,hasError:!!eventTypeError,errorMessage:eventTypeError?.message,availabilityScheduleId:eventType?.availability_schedule_id,userId:eventType?.user_id},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      if (eventType) {
        // Verify event type belongs to the dietitian
        if (eventType.user_id !== targetDietitianId) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:72',message:'Event type ownership mismatch',data:{eventTypeUserId:eventType.user_id,targetDietitianId},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          return NextResponse.json(
            { error: "Event type does not belong to this dietitian" },
            { status: 403 }
          );
        }
        
        // If event type has specific schedule, use it; otherwise will use default
        scheduleIdToUse = eventType.availability_schedule_id;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:80',message:'Schedule ID determined',data:{scheduleIdToUse},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      }
    }

    // Check if all availability is toggled off
    // First check if any schedules are active (if all are inactive, return empty slots)
    const { data: allSchedules, error: allSchedulesError } = await supabaseAdmin
      .from("availability_schedules")
      .select("id, name, active, is_default")
      .eq("dietitian_id", targetDietitianId);
    
    console.log('📊 [DEBUG] All schedules check:', {
      count: allSchedules?.length || 0,
      schedules: allSchedules?.map(s => ({ id: s.id, name: s.name, active: s.active, isDefault: s.is_default })),
      error: allSchedulesError?.message,
      allInactive: allSchedules && allSchedules.length > 0 && allSchedules.every(s => s.active === false)
    });
    
    // If all schedules are inactive, return empty slots
    if (allSchedules && allSchedules.length > 0 && allSchedules.every(s => s.active === false)) {
      console.log('🚫 [DEBUG] All schedules are inactive - returning empty slots');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:92',message:'All schedules inactive',data:{targetDietitianId,allSchedulesCount:allSchedules.length},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return NextResponse.json({ slots: [], timezone: "Africa/Lagos" });
    }

    // Build query to fetch the appropriate schedule (only active ones)
    let scheduleQuery = supabaseAdmin
      .from("availability_schedules")
      .select(`
        id,
        timezone,
        availability_schedule_slots (
          day_of_week,
          start_time,
          end_time,
          enabled
        )
      `)
      .eq("dietitian_id", targetDietitianId)
      .eq("active", true);
    
    if (scheduleIdToUse) {
      // Use specific schedule from event type
      scheduleQuery = scheduleQuery.eq("id", scheduleIdToUse);
    } else {
      // Use default schedule (inherit behavior)
      scheduleQuery = scheduleQuery.eq("is_default", true);
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:141',message:'About to execute schedule query',data:{scheduleIdToUse,usingSpecific:!!scheduleIdToUse,usingDefault:!scheduleIdToUse,targetDietitianId},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    let schedules, schedulesError;
    try {
      const result = await scheduleQuery;
      schedules = result.data;
      schedulesError = result.error;
    } catch (queryException) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:144',message:'Schedule query threw exception',data:{exceptionMessage:queryException instanceof Error ? queryException.message : String(queryException),exceptionStack:queryException instanceof Error ? queryException.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      schedulesError = { message: queryException instanceof Error ? queryException.message : String(queryException), code: 'QUERY_EXCEPTION' };
      schedules = null;
    }
    console.log('🔍 [DEBUG] Schedule query executed:', {
      schedulesCount: schedules?.length || 0,
      hasError: !!schedulesError,
      errorMessage: schedulesError?.message,
      errorCode: schedulesError?.code,
      scheduleIdToUse,
      schedules: schedules?.map(s => ({
        id: s.id,
        timezone: s.timezone,
        slotsCount: s.availability_schedule_slots?.length || 0,
        slots: s.availability_schedule_slots?.slice(0, 3) // First 3 slots for debugging
      }))
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:151',message:'Schedule query executed',data:{schedulesCount:schedules?.length||0,hasError:!!schedulesError,errorMessage:schedulesError?.message,errorCode:schedulesError?.code,errorDetails:schedulesError?.details,errorHint:schedulesError?.hint,scheduleIdToUse},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // If specific schedule not found, fall back to default
    if (scheduleIdToUse && (!schedules || schedules.length === 0)) {
      console.warn(`Schedule ${scheduleIdToUse} not found, falling back to default`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:123',message:'Falling back to default schedule',data:{scheduleIdToUse},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const { data: defaultSchedules } = await supabaseAdmin
        .from("availability_schedules")
        .select(`
          id,
          timezone,
          availability_schedule_slots (
            day_of_week,
            start_time,
            end_time,
            enabled
          )
        `)
        .eq("dietitian_id", targetDietitianId)
        .eq("active", true)
        .eq("is_default", true);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:144',message:'Default schedule query result',data:{defaultSchedulesCount:defaultSchedules?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      if (defaultSchedules && defaultSchedules.length > 0) {
        schedules = defaultSchedules;
      }
    }

    if (schedulesError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:156',message:'Schedule query error detected - RETURNING 500',data:{errorMessage:schedulesError.message,errorCode:schedulesError.code,errorDetails:schedulesError.details,errorHint:schedulesError.hint,fullError:JSON.stringify(schedulesError)},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.error("Error fetching schedules:", {
        message: schedulesError.message,
        code: schedulesError.code,
        details: schedulesError.details,
        hint: schedulesError.hint,
        fullError: schedulesError
      });
      return NextResponse.json(
        { error: "Failed to fetch availability schedules", details: schedulesError.message, code: schedulesError.code },
        { status: 500 }
      );
    }

    // If no schedules found, return empty slots
    if (!schedules || schedules.length === 0) {
      console.error('❌ [DEBUG] No schedules found:', {
        scheduleIdToUse,
        targetDietitianId,
        eventTypeId,
        reason: scheduleIdToUse ? 'Specific schedule not found' : 'No default schedule found'
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:155',message:'No schedules found',data:{scheduleIdToUse,targetDietitianId,eventTypeId},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return NextResponse.json({ slots: [] });
    }

    // Get the default schedule (or first schedule)
    const defaultSchedule = schedules[0];
    let timezone = defaultSchedule.timezone || "Africa/Lagos";
    
    // Validate timezone and fallback if invalid
    if (!TimezoneHelper.validateTimezone(timezone)) {
      console.warn(`⚠️ [FIXED] Invalid timezone ${timezone}, falling back to Africa/Lagos`);
      timezone = "Africa/Lagos";
    }
    
    console.log(`🌍 [FIXED] Using timezone: ${timezone}`);

    // Convert schedule slots to AvailabilitySlot format
    const availabilitySlots: AvailabilitySlot[] = (
      defaultSchedule.availability_schedule_slots || []
    )
      .filter((slot: any) => slot.enabled)
      .map((slot: any) => ({
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        enabled: true,
      }));
    
    console.log('⏰ [DEBUG] Availability slots converted:', {
      totalSlots: defaultSchedule.availability_schedule_slots?.length || 0,
      enabledSlots: availabilitySlots.length,
      slotsByDay: availabilitySlots.reduce((acc, slot) => {
        const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.dayOfWeek];
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      sampleSlots: availabilitySlots.slice(0, 5)
    });

    // Fetch existing bookings in the date range
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from("bookings")
      .select("start_time, end_time, status")
      .eq("dietitian_id", targetDietitianId)
      .gte("start_time", startDate.toISOString())
      .lte("end_time", endDate.toISOString())
      .in("status", ["PENDING", "CONFIRMED"]); // Only count pending and confirmed bookings

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
      // Continue with empty bookings array
    }

    // Fetch out-of-office periods that overlap with the date range
    const { data: oooPeriods, error: oooError } = await supabaseAdmin
      .from("out_of_office_periods")
      .select("start_date, end_date")
      .eq("dietitian_id", targetDietitianId)
      .lte("start_date", endDateStr)
      .gte("end_date", startDateStr);

    if (oooError) {
      console.error("Error fetching OOO periods:", oooError);
      // Continue with empty OOO array
    }

    // Fetch date overrides for the date range
    const { data: overrides, error: overridesError } = await supabaseAdmin
      .from("availability_date_overrides")
      .select(`
        override_date,
        is_unavailable,
        availability_date_override_slots (
          start_time,
          end_time
        )
      `)
      .eq("dietitian_id", targetDietitianId)
      .gte("override_date", startDateStr)
      .lte("override_date", endDateStr);

    if (overridesError) {
      console.error("Error fetching date overrides:", overridesError);
      // Continue with empty overrides array
    }

    // Format OOO periods
    const formattedOOOPeriods: OutOfOfficePeriod[] = (oooPeriods || []).map((period: any) => ({
      startDate: period.start_date,
      endDate: period.end_date,
    }));

    // Format date overrides
    const formattedOverrides: DateOverride[] = (overrides || []).map((override: any) => ({
      overrideDate: override.override_date,
      isUnavailable: override.is_unavailable,
      slots: override.is_unavailable
        ? undefined
        : (override.availability_date_override_slots || []).map((slot: any) => ({
            startTime: slot.start_time,
            endTime: slot.end_time,
          })),
    }));

    console.log('🧮 [DEBUG] About to calculate slots:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      availabilitySlotsCount: availabilitySlots.length,
      bookingsCount: bookings?.length || 0,
      durationMinutes,
      timezone,
      oooPeriodsCount: formattedOOOPeriods.length,
      overridesCount: formattedOverrides.length
    });
    
    // Calculate available slots with OOO and overrides
    const availableSlots = calculateSlotsForDateRange(
      startDate,
      endDate,
      availabilitySlots,
      (bookings || []).map((b: any) => ({
        startTime: b.start_time,
        endTime: b.end_time,
        status: b.status,
      })),
      durationMinutes,
      timezone,
      formattedOOOPeriods,
      formattedOverrides
    );

    console.log('✅ [DEBUG] Calculation complete:', {
      slotsCount: availableSlots.length,
      timezone,
      scheduleId: defaultSchedule.id,
      sampleSlots: availableSlots.slice(0, 3)
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:256',message:'Returning slots',data:{slotsCount:availableSlots.length,timezone,scheduleId:defaultSchedule.id},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({
      slots: availableSlots,
      timezone,
      scheduleId: defaultSchedule.id,
    });
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/47c98e00-030f-46e7-b782-5ff73cdaf6f4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeslots/route.ts:261',message:'Error caught',data:{errorMessage:error.message,isAuthError:error.message === "Unauthorized" || error.message.includes("Forbidden"),status:error.status},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error calculating timeslots:", error);
    return NextResponse.json(
      { error: "Failed to calculate timeslots", details: error.message },
      { status: 500 }
    );
  }
}

