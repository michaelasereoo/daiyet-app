/**
 * Event Types Configuration
 * Centralized configuration for allowed event types in the booking flow
 */

export const BOOK_A_CALL_ALLOWED_EVENT_TYPES = {
  /**
   * Allowed event type slugs for the "Book a Call" flow
   * Only these event types will be displayed to users
   */
  ALLOWED_SLUGS: [
    '1-on-1-nutritional-counselling-and-assessment',
    '1-on-1-nutritional-counselling-and-assessment-meal-plan',
    'monitoring',
    'test-event',
  ] as const,

  /**
   * Old event type slugs that should be excluded
   * These are legacy event types that have been deprecated
   */
  EXCLUDED_SLUGS: [
    'free-trial-consultation',
    '1-on-1-consultation-with-licensed-dietician',
    'free-trial',
    'freetrial',
  ] as const,

  /**
   * Keywords in titles that indicate old/excluded event types
   */
  EXCLUDED_TITLE_KEYWORDS: [
    'free trial',
    'free-trial',
    'freetrial',
  ] as const,
} as const;

/**
 * Type for allowed event type slugs
 */
export type AllowedEventTypeSlug = typeof BOOK_A_CALL_ALLOWED_EVENT_TYPES.ALLOWED_SLUGS[number];

/**
 * Check if an event type slug is allowed for booking
 */
export function isAllowedEventTypeSlug(slug: string): boolean {
  return BOOK_A_CALL_ALLOWED_EVENT_TYPES.ALLOWED_SLUGS.includes(
    slug.toLowerCase() as AllowedEventTypeSlug
  );
}

/**
 * Check if an event type should be excluded based on its slug
 */
export function isExcludedEventTypeSlug(slug: string): boolean {
  const slugLower = slug.toLowerCase();
  return BOOK_A_CALL_ALLOWED_EVENT_TYPES.EXCLUDED_SLUGS.some(
    excluded => slugLower === excluded || slugLower.includes(excluded)
  );
}

/**
 * Check if an event type title contains excluded keywords
 */
export function hasExcludedKeywords(title: string): boolean {
  const titleLower = title.toLowerCase();
  return BOOK_A_CALL_ALLOWED_EVENT_TYPES.EXCLUDED_TITLE_KEYWORDS.some(
    keyword => titleLower.includes(keyword)
  ) || (titleLower.includes('free') && titleLower.includes('trial'));
}
