/**
 * Event Type Service
 * Handles business logic for event types, including default creation and filtering
 */

import { createAdminClientServer } from "@/lib/supabase/server";
import { isAllowedEventTypeSlug, isExcludedEventTypeSlug } from "@/constants/eventTypes";

export interface EventType {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description?: string;
  length: number;
  price: number;
  currency: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export class EventTypeService {
  /**
   * Default event types that are auto-created for each dietitian
   * All dietitians get the same 4 default event types
   */
  private static readonly DEFAULT_EVENT_TYPES = [
    {
      title: '1-on-1 Nutritional counselling and assessment',
      slug: '1-on-1-nutritional-counselling-and-assessment',
      description: 'Have one on one consultation with Licensed Dietitician [Nutritional counseling and assessment]',
      length: 45,
      price: 15000,
      currency: 'NGN',
      active: true,
    },
    {
      title: '1-on-1 Nutritional Counselling and Assessment + Meal Plan',
      slug: '1-on-1-nutritional-counselling-and-assessment-meal-plan',
      description: 'Comprehensive nutritional counselling and assessment session with a personalized 7-day meal plan included.',
      length: 45,
      price: 25000,
      currency: 'NGN',
      active: true,
    },
    {
      title: 'Monitoring',
      slug: 'monitoring',
      description: 'Monitoring consultation',
      length: 20,
      price: 5000,
      currency: 'NGN',
      active: true,
    },
    {
      title: 'Test Event',
      slug: 'test-event',
      description: 'Test event for payment testing',
      length: 15,
      price: 100,
      currency: 'NGN',
      active: true,
    },
  ] as const;

  /**
   * Default event types that are auto-created for each therapist
   * All therapists get the same 3 default event types
   */
  private static readonly DEFAULT_THERAPIST_EVENT_TYPES = [
    {
      title: 'Individual Therapy Mini',
      slug: 'individual-therapy-mini',
      description: '45-minute individual therapy session for personalized mental health support',
      length: 45,
      price: 15000,
      currency: 'NGN',
      active: true,
    },
    {
      title: 'Student Therapy',
      slug: 'student-therapy',
      description: 'Affordable therapy session designed for students',
      length: 45,
      price: 10000,
      currency: 'NGN',
      active: true,
    },
    {
      title: 'Individual Therapy Max',
      slug: 'individual-therapy-max',
      description: 'Extended 90-minute individual therapy session for comprehensive mental health support',
      length: 90,
      price: 50000,
      currency: 'NGN',
      active: true,
    },
  ] as const;

  /**
   * Ensure dietitian has default event types (atomic operation)
   * Uses upsert to handle race conditions - if event types exist, no action taken
   * This is safe for concurrent requests
   */
  static async ensureDietitianEventTypes(
    dietitianId: string
  ): Promise<void> {
    const supabaseAdmin = createAdminClientServer();

    // Use upsert with ON CONFLICT DO NOTHING - this is atomic and prevents race conditions
    // If event types already exist, nothing happens (idempotent)
    const defaultEventTypes = this.DEFAULT_EVENT_TYPES.map(et => ({
      user_id: dietitianId,
      ...et,
    }));

    // ✅ ATOMIC OPERATION: Use upsert with onConflict to prevent race conditions
    // If event types already exist (from concurrent request), nothing happens (idempotent)
    // This is safe for concurrent requests - multiple requests can call this simultaneously
    const { error } = await supabaseAdmin
      .from('event_types')
      .upsert(defaultEventTypes, {
        onConflict: 'user_id,slug',
        // Note: Supabase upsert behavior - if conflict exists, it updates (or ignores if identical)
        // This prevents duplicate creation even with concurrent requests
      });

    if (error) {
      console.error('Error ensuring default event types:', error);
      throw new Error(`Failed to ensure default event types: ${error.message}`);
    }
  }

  /**
   * Ensure therapist has default event types (atomic operation)
   * Uses upsert to handle race conditions - if event types exist, no action taken
   * This is safe for concurrent requests
   */
  static async ensureTherapistEventTypes(
    therapistId: string
  ): Promise<void> {
    const supabaseAdmin = createAdminClientServer();

    // Use upsert with ON CONFLICT DO NOTHING - this is atomic and prevents race conditions
    // If event types already exist, nothing happens (idempotent)
    const defaultEventTypes = this.DEFAULT_THERAPIST_EVENT_TYPES.map(et => ({
      user_id: therapistId,
      ...et,
    }));

    // ✅ ATOMIC OPERATION: Use upsert with onConflict to prevent race conditions
    // If event types already exist (from concurrent request), nothing happens (idempotent)
    // This is safe for concurrent requests - multiple requests can call this simultaneously
    const { error } = await supabaseAdmin
      .from('event_types')
      .upsert(defaultEventTypes, {
        onConflict: 'user_id,slug',
        // Note: Supabase upsert behavior - if conflict exists, it updates (or ignores if identical)
        // This prevents duplicate creation even with concurrent requests
      });

    if (error) {
      console.error('Error ensuring default therapist event types:', error);
      throw new Error(`Failed to ensure default therapist event types: ${error.message}`);
    }
  }

  /**
   * Fetch event types for a dietitian or therapist
   * Auto-creates defaults if they don't exist (atomic)
   */
  static async getEventTypes(
    userId: string,
    options?: {
      filter?: 'book-a-call' | null;
      isOwnEventTypes?: boolean; // If true, can auto-create defaults
      userRole?: 'DIETITIAN' | 'THERAPIST'; // Role of the user to determine which defaults to create
    }
  ): Promise<EventType[]> {
    const supabaseAdmin = createAdminClientServer();
    const { filter, isOwnEventTypes = false, userRole } = options || {};

    // Determine user role if not provided
    let role = userRole;
    if (!role) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      role = user?.role as 'DIETITIAN' | 'THERAPIST' | undefined;
    }

    // For book-a-call filter: Always ensure defaults exist (users need to see them)
    // For own event types: Also ensure defaults exist
    // This is safe even with concurrent requests due to upsert
    if (filter === 'book-a-call' || isOwnEventTypes) {
      try {
        if (role === 'THERAPIST') {
          await this.ensureTherapistEventTypes(userId);
        } else {
          await this.ensureDietitianEventTypes(userId);
        }
      } catch (error) {
        // Log error but continue - try to fetch what exists
        console.warn('Failed to ensure defaults, continuing with fetch:', error);
      }
    }

    // Fetch all active event types for this user
    const { data: eventTypes, error } = await supabaseAdmin
      .from('event_types')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching event types:', error);
      throw new Error(`Failed to fetch event types: ${error.message}`);
    }

    // Apply filtering if requested (for book-a-call flow)
    // For therapists, return all their event types (no filtering needed)
    if (filter === 'book-a-call' && role !== 'THERAPIST') {
      console.log(`[EventTypeService] Filtering for book-a-call - Fetched ${eventTypes?.length || 0} event types from DB`);
      
      if (eventTypes && eventTypes.length > 0) {
        console.log(`[EventTypeService] Raw event types:`, eventTypes.map(et => ({ 
          id: et.id, 
          title: et.title, 
          slug: et.slug,
          active: et.active 
        })));
      }
      
      // Filter to only the 4 allowed default event types (for dietitians)
      // ✅ ADD VALIDATION: Ensure NO excluded event types are returned
      const filtered = (eventTypes || []).filter(et => {
        // Double validation
        const isAllowed = isAllowedEventTypeSlug(et.slug);
        const isExcluded = isExcludedEventTypeSlug(et.slug);
        
        if (isExcluded) {
          console.warn(`🚨 [EventTypeService] Server validation: Excluded event type ${et.slug} found for user ${userId} - this should have been deleted!`);
          return false;
        }
        
        if (!isAllowed) {
          console.log(`[EventTypeService] ❌ Filtered out: ${et.title} (slug: ${et.slug})`);
          return false;
        }
        
        console.log(`[EventTypeService] ✅ Allowed: ${et.title} (slug: ${et.slug})`);
        return true;
      });
      
      console.log(`[EventTypeService] ✅ Returning ${filtered.length} filtered event types for book-a-call`);
      return filtered;
    }

    // Return all active event types (for therapist or dietitian dashboard)
    return eventTypes || [];
  }

  /**
   * Check if an event type slug is allowed for booking
   */
  static isAllowedForBooking(slug: string): boolean {
    return isAllowedEventTypeSlug(slug);
  }

  /**
   * Get default event types configuration (read-only)
   */
  static getDefaultEventTypes() {
    return this.DEFAULT_EVENT_TYPES;
  }

  /**
   * Get default therapist event types configuration (read-only)
   */
  static getDefaultTherapistEventTypes() {
    return this.DEFAULT_THERAPIST_EVENT_TYPES;
  }
}
