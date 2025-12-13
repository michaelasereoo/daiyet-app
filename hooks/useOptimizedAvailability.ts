import { useState, useEffect, useRef, useCallback } from 'react';

interface UseOptimizedAvailabilityOptions {
  dietitianId: string;
  eventTypeId?: string;
  startDate?: Date;
  endDate?: Date;
  durationMinutes?: number;
  initialData?: any;
  enabled?: boolean;
}

export function useOptimizedAvailability({
  dietitianId,
  eventTypeId,
  startDate,
  endDate,
  durationMinutes = 30,
  initialData,
  enabled = true
}: UseOptimizedAvailabilityOptions) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Smart polling state
  const pollIntervalRef = useRef<NodeJS.Timeout>();
  const lastFetchRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef<number>(0);
  const isTabVisibleRef = useRef<boolean>(true);

  // Exponential backoff with jitter
  const getNextPollInterval = useCallback(() => {
    const baseInterval = 30000; // 30 seconds base
    const maxInterval = 300000; // 5 minutes max
    const backoffFactor = Math.min(consecutiveErrorsRef.current, 5);
    
    const interval = baseInterval * Math.pow(2, backoffFactor);
    const jitter = Math.random() * 0.3 * interval; // ±30% jitter
    
    return Math.min(interval + jitter, maxInterval);
  }, []);

  const fetchAvailability = useCallback(async () => {
    if (!enabled || !dietitianId || !startDate || !endDate) return;
    
    const now = Date.now();
    // Don't fetch more than once per 10 seconds
    if (now - lastFetchRef.current < 10000) return;
    
    setIsLoading(true);
    
    try {
      // Build query params
      const params = new URLSearchParams({
        dietitianId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        duration: durationMinutes.toString(),
      });
      
      if (eventTypeId) {
        params.append('eventTypeId', eventTypeId);
      }

      const response = await fetch(`/api/availability/timeslots?${params.toString()}`, {
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result);
      setError(null);
      consecutiveErrorsRef.current = 0; // Reset on success
      lastFetchRef.current = now;
      
      // Store in localStorage for offline fallback
      if (typeof window !== "undefined") {
        const cacheKey = `availability_timeslots_${dietitianId}_${eventTypeId || 'default'}`;
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data: result,
            timestamp: now
          })
        );
      }
    } catch (err) {
      consecutiveErrorsRef.current++;
      setError(err instanceof Error ? err.message : 'Fetch failed');
      
      // Try to load from cache
      if (typeof window !== "undefined") {
        const cacheKey = `availability_timeslots_${dietitianId}_${eventTypeId || 'default'}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Use cached data if less than 5 minutes old
          if (now - parsed.timestamp < 300000) {
            setData(parsed.data);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [dietitianId, eventTypeId, startDate, endDate, durationMinutes, enabled]);

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
      if (!document.hidden) {
        // Tab became visible, refresh data
        fetchAvailability();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAvailability]);

  // Smart polling setup
  useEffect(() => {
    if (!enabled || !dietitianId || !isTabVisibleRef.current || !startDate || !endDate) return;

    const poll = () => {
      if (isTabVisibleRef.current) {
        fetchAvailability();
      }
      
      // Schedule next poll with dynamic interval
      clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = setTimeout(poll, getNextPollInterval());
    };

    // Initial fetch
    fetchAvailability();
    pollIntervalRef.current = setTimeout(poll, getNextPollInterval());

    return () => {
      clearTimeout(pollIntervalRef.current);
    };
  }, [dietitianId, eventTypeId, startDate, endDate, enabled, fetchAvailability, getNextPollInterval]);

  return { data, isLoading, error, refetch: fetchAvailability };
}

