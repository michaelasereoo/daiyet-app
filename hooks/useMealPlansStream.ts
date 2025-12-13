import { useEffect, useState } from "react";

interface MealPlan {
  id: string;
  sessionRequestId?: string;
  userId: string;
  dietitianId: string;
  userName: string;
  userEmail: string;
  dietitianName: string;
  dietitianEmail: string;
  packageName: string;
  fileUrl?: string;
  fileName?: string;
  status: "PENDING" | "SENT";
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function useMealPlansStream() {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/meal-plans/stream", {
          withCredentials: true,
        });

        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
          reconnectAttempts = 0;
        };

        eventSource.onmessage = (event) => {
          try {
            // Handle keepalive
            if (event.data.trim() === ": keepalive") {
              return;
            }

            const { type, data, error: eventError } = JSON.parse(event.data);
            
            if (type === "initial") {
              setMealPlans(data || []);
            } else if (type === "update") {
              setMealPlans(data || []);
            } else if (type === "error") {
              setError(eventError || "An error occurred");
            }
          } catch (err) {
            console.error("Failed to parse SSE message:", err);
          }
        };

        eventSource.onerror = (err) => {
          console.error("SSE error:", err);
          setIsConnected(false);
          
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            setError(`Connection lost. Reconnecting in ${delay / 1000}s...`);
            
            reconnectTimeout = setTimeout(() => {
              connect();
            }, delay);
          } else {
            setError("Connection lost. Please refresh the page.");
          }
        };
      } catch (err) {
        console.error("Error creating EventSource:", err);
        setError("Failed to establish connection");
      }
    };

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  return { mealPlans, isConnected, error };
}

