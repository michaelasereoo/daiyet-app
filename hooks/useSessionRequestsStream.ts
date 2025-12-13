import { useEffect, useState, useCallback } from "react";

interface SessionRequest {
  id: string;
  requestType: "CONSULTATION" | "MEAL_PLAN" | "RESCHEDULE_REQUEST";
  clientName: string;
  clientEmail: string;
  message?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  eventType?: {
    id: string;
    title: string;
  };
  mealPlanType?: string;
  price?: number;
  currency?: string;
  duration?: number;
  requestedDate?: string;
  createdAt: string;
}

export function useSessionRequestsStream() {
  const [requests, setRequests] = useState<SessionRequest[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/session-requests/stream", {
          withCredentials: true,
        });

        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
          reconnectAttempts = 0; // Reset on successful connection
        };

        eventSource.onmessage = (event) => {
          try {
            const { type, data, error: eventError } = JSON.parse(event.data);
            
            if (type === "initial") {
              setRequests(data || []);
            } else if (type === "update") {
              setRequests(data || []);
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
          
          // Close and attempt reconnect
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
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

  return { requests, isConnected, error };
}

