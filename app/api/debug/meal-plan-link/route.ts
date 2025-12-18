import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionRequestId = searchParams.get('sessionRequestId');
  
  if (!sessionRequestId) {
    return NextResponse.json({ error: 'sessionRequestId required' }, { status: 400 });
  }
  
  try {
    const supabaseAdmin = createAdminClientServer();
    
    // 1. Get the session request
    const { data: sessionRequest, error: srError } = await supabaseAdmin
      .from('session_requests')
      .select('*')
      .eq('id', sessionRequestId)
      .single();
    
    if (srError) throw srError;
    
    // 2. Try to find meal plan by session_request_id
    // Use .limit(1) instead of .maybeSingle() to handle multiple meal plans linked to same request
    let { data: mealPlans, error: mpError } = await supabaseAdmin
      .from('meal_plans')
      .select('*')
      .eq('session_request_id', sessionRequestId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    let mealPlan = mealPlans && mealPlans.length > 0 ? mealPlans[0] : null;
    
    console.log('[DEBUG] Direct query result:', {
      found: !!mealPlan,
      error: mpError?.message,
      mealPlanId: mealPlan?.id,
      totalResults: mealPlans?.length || 0,
      hasMultiple: (mealPlans?.length || 0) > 1,
    });
    
    // 3. If not found, try the alternative logic
    let alternativeMethod = 'none';
    let userLookup = null;
    
    if (!mealPlan && !mpError) {
      console.log('[DEBUG] Trying alternative lookup methods...');
      
      // Get user by email
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, email, name')
        .eq('email', sessionRequest.client_email?.toLowerCase().trim())
        .maybeSingle();
      
      userLookup = {
        email: sessionRequest.client_email,
        found: !!user,
        userId: user?.id || null,
        userName: user?.name || null,
      };
      
      console.log('[DEBUG] User lookup:', userLookup);
      
      if (user) {
        // Strategy 1: Exact match by dietitian_id, user_id, and package_name
        const { data: exactMealPlans, error: exactError } = await supabaseAdmin
          .from('meal_plans')
          .select('*')
          .eq('dietitian_id', sessionRequest.dietitian_id)
          .eq('user_id', user.id)
          .eq('package_name', sessionRequest.meal_plan_type || '')
          .order('created_at', { ascending: false })
          .limit(1);
        
        const exactMealPlan = exactMealPlans && exactMealPlans.length > 0 ? exactMealPlans[0] : null;
        
        console.log('[DEBUG] Exact match query:', {
          found: !!exactMealPlan,
          error: exactError?.message,
          mealPlanId: exactMealPlan?.id,
        });
        
        if (exactMealPlan && !exactError) {
          mealPlan = exactMealPlan;
          alternativeMethod = 'exact_match';
        } else {
          // Strategy 2: Broader search by dietitian_id and user_id only
          const { data: broaderMealPlans, error: broaderError } = await supabaseAdmin
            .from('meal_plans')
            .select('*')
            .eq('dietitian_id', sessionRequest.dietitian_id)
            .eq('user_id', user.id)
            .is('session_request_id', null)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const broaderMealPlan = broaderMealPlans && broaderMealPlans.length > 0 ? broaderMealPlans[0] : null;
          
          console.log('[DEBUG] Broader match query:', {
            found: !!broaderMealPlan,
            error: broaderError?.message,
            mealPlanId: broaderMealPlan?.id,
          });
          
          if (broaderMealPlan && !broaderError) {
            mealPlan = broaderMealPlan;
            alternativeMethod = 'broader_match';
          } else {
            // Strategy 3: Last resort - most recent unlinked meal plan by dietitian
            const { data: recentMealPlans, error: recentError } = await supabaseAdmin
              .from('meal_plans')
              .select('*')
              .eq('dietitian_id', sessionRequest.dietitian_id)
              .is('session_request_id', null)
              .order('created_at', { ascending: false })
              .limit(1);
            
            const recentMealPlan = recentMealPlans && recentMealPlans.length > 0 ? recentMealPlans[0] : null;
            
            console.log('[DEBUG] Last resort query:', {
              found: !!recentMealPlan,
              error: recentError?.message,
              mealPlanId: recentMealPlan?.id,
            });
            
            if (recentMealPlan && !recentError) {
              mealPlan = recentMealPlan;
              alternativeMethod = 'last_resort';
            }
          }
        }
      }
    }
    
    // 4. Count total meal plans linked to this session request (without limit)
    const { data: allMealPlansForRequest, count: totalCount } = await supabaseAdmin
      .from('meal_plans')
      .select('id, session_request_id, user_id, dietitian_id, package_name, created_at, file_url', { count: 'exact' })
      .eq('session_request_id', sessionRequestId)
      .order('created_at', { ascending: false });
    
    // 5. Also check all meal plans for this dietitian to see what's available
    const { data: allMealPlans } = await supabaseAdmin
      .from('meal_plans')
      .select('id, session_request_id, user_id, dietitian_id, package_name, created_at, file_url')
      .eq('dietitian_id', sessionRequest.dietitian_id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      sessionRequest: {
        id: sessionRequest.id,
        request_type: sessionRequest.request_type,
        status: sessionRequest.status,
        client_email: sessionRequest.client_email,
        meal_plan_type: sessionRequest.meal_plan_type,
        dietitian_id: sessionRequest.dietitian_id,
        created_at: sessionRequest.created_at,
      },
      mealPlan: mealPlan ? {
        id: mealPlan.id,
        session_request_id: mealPlan.session_request_id,
        user_id: mealPlan.user_id,
        dietitian_id: mealPlan.dietitian_id,
        package_name: mealPlan.package_name,
        file_url: mealPlan.file_url,
        status: mealPlan.status,
        created_at: mealPlan.created_at,
      } : null,
      alternativeMethod,
      found: !!mealPlan,
      error: mpError?.message || null,
      userLookup,
      multipleMealPlansLinked: (totalCount || 0) > 1,
      totalMealPlansForRequest: totalCount || 0,
      allMealPlansForRequest: allMealPlansForRequest?.map(mp => ({
        id: mp.id,
        session_request_id: mp.session_request_id,
        user_id: mp.user_id,
        package_name: mp.package_name,
        hasFileUrl: !!mp.file_url,
        created_at: mp.created_at,
      })) || [],
      allMealPlans: allMealPlans?.map(mp => ({
        id: mp.id,
        session_request_id: mp.session_request_id,
        user_id: mp.user_id,
        package_name: mp.package_name,
        hasFileUrl: !!mp.file_url,
        created_at: mp.created_at,
      })) || [],
    });
    
  } catch (error: any) {
    console.error('[DEBUG ERROR]:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

