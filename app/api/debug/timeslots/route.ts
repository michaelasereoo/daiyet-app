import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// GET: Debug endpoint to diagnose availability issues
export async function GET(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;
    
    const date = request.nextUrl.searchParams.get("date") || dayjs().format("YYYY-MM-DD");
    const testDietitianId = request.nextUrl.searchParams.get("dietitianId") || dietitianId;
    
    console.log('🔬 [DEBUG] Manual test for:', { dietitianId: testDietitianId, date });
    
    const supabaseAdmin = createAdminClientServer();
    
    // 1. Get all schedules
    const { data: schedules, error: schedError } = await supabaseAdmin
      .from('availability_schedules')
      .select('*')
      .eq('dietitian_id', testDietitianId)
      .order('is_default', { ascending: false });
    
    console.log('📋 [DEBUG] Schedules:', {
      count: schedules?.length,
      schedules: schedules?.map(s => ({
        id: s.id,
        name: s.name,
        isDefault: s.is_default,
        active: s.active,
        timezone: s.timezone
      })),
      error: schedError?.message
    });
    
    // 2. Get slots for default schedule
    const defaultSchedule = schedules?.find(s => s.is_default) || schedules?.[0];
    
    if (!defaultSchedule) {
      return NextResponse.json({ 
        error: 'No schedule found',
        hasSchedules: schedules && schedules.length > 0,
        schedulesCount: schedules?.length || 0
      }, { status: 400 });
    }
    
    const { data: slots, error: slotsError } = await supabaseAdmin
      .from('availability_schedule_slots')
      .select('*')
      .eq('schedule_id', defaultSchedule.id);
    
    console.log('⏰ [DEBUG] Schedule slots:', {
      count: slots?.length,
      enabledCount: slots?.filter(s => s.enabled).length,
      slots: slots?.map(s => ({
        dayOfWeek: s.day_of_week,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][s.day_of_week],
        startTime: s.start_time,
        endTime: s.end_time,
        enabled: s.enabled
      })),
      error: slotsError?.message
    });
    
    // 3. Calculate manually for the test date
    const dayOfWeek = dayjs(date).day(); // 0 = Sunday
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    const todaySlots = slots?.filter(s => s.day_of_week === dayOfWeek && s.enabled) || [];
    
    console.log('🎯 [DEBUG] Today analysis:', {
      date,
      dayOfWeek,
      dayName,
      todaySlotsCount: todaySlots.length,
      todaySlots
    });
    
    // 4. Check bookings
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('start_time, end_time, status')
      .eq('dietitian_id', testDietitianId)
      .gte('start_time', dayjs(date).startOf('day').toISOString())
      .lte('end_time', dayjs(date).endOf('day').toISOString())
      .in('status', ['PENDING', 'CONFIRMED']);
    
    console.log('📅 [DEBUG] Bookings for date:', {
      count: bookings?.length || 0,
      bookings: bookings?.map(b => ({
        start: b.start_time,
        end: b.end_time,
        status: b.status
      })),
      error: bookingsError?.message
    });
    
    // 5. Check OOO periods
    const { data: oooPeriods, error: oooError } = await supabaseAdmin
      .from('out_of_office_periods')
      .select('*')
      .eq('dietitian_id', testDietitianId)
      .lte('start_date', date)
      .gte('end_date', date);
    
    console.log('🚫 [DEBUG] OOO periods:', {
      count: oooPeriods?.length || 0,
      periods: oooPeriods,
      error: oooError?.message
    });
    
    // 6. Check date overrides
    const { data: overrides, error: overridesError } = await supabaseAdmin
      .from('availability_date_overrides')
      .select('*')
      .eq('dietitian_id', testDietitianId)
      .eq('override_date', date);
    
    console.log('🔄 [DEBUG] Date overrides:', {
      count: overrides?.length || 0,
      overrides,
      error: overridesError?.message
    });
    
    return NextResponse.json({
      success: true,
      dietitianId: testDietitianId,
      date,
      dayOfWeek,
      dayName,
      hasDefaultSchedule: !!defaultSchedule,
      defaultSchedule: {
        id: defaultSchedule.id,
        name: defaultSchedule.name,
        isDefault: defaultSchedule.is_default,
        active: defaultSchedule.active,
        timezone: defaultSchedule.timezone
      },
      totalSlots: slots?.length || 0,
      enabledSlots: slots?.filter(s => s.enabled).length || 0,
      todaySlots: todaySlots.length,
      todaySlotsData: todaySlots.map(s => ({
        dayOfWeek: s.day_of_week,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][s.day_of_week],
        startTime: s.start_time,
        endTime: s.end_time,
        enabled: s.enabled
      })),
      bookingsCount: bookings?.length || 0,
      oooPeriodsCount: oooPeriods?.length || 0,
      overridesCount: overrides?.length || 0,
      dayOfWeekMapping: {
        javascript: dayOfWeek,
        days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      },
      slotsByDay: slots?.reduce((acc, s) => {
        const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][s.day_of_week];
        if (!acc[day]) acc[day] = { total: 0, enabled: 0 };
        acc[day].total++;
        if (s.enabled) acc[day].enabled++;
        return acc;
      }, {} as Record<string, { total: number; enabled: number }>)
    });
  } catch (error: any) {
    console.error('❌ [DEBUG] Debug endpoint error:', error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    return NextResponse.json(
      { error: "Debug failed", details: error.message },
      { status: 500 }
    );
  }
}

