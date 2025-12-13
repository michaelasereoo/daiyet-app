import { useEffect, useState, useCallback } from "react";

interface Booking {
  id: string;
  title: string;
  description?: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  status: string;
  meetingLink?: string;
  eventType?: {
    id: string;
    title: string;
    slug: string;
    length: number;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
  dietitian?: {
    id: string;
    name: string;
    email: string;
    bio?: string;
    image?: string;
  };
  participants: string[];
}

export function useBookingsStream() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/bookings/stream", {
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
              // Convert date strings to Date objects
              const formattedBookings = (data || []).map((booking: any) => ({
                ...booking,
                date: new Date(booking.date),
                startTime: new Date(booking.startTime),
                endTime: new Date(booking.endTime),
                meetingLink: booking.meetingLink || booking.meeting_link || undefined,
              }));
              setBookings(formattedBookings);
            } else if (type === "update") {
              const formattedBookings = (data || []).map((booking: any) => ({
                ...booking,
                date: new Date(booking.date),
                startTime: new Date(booking.startTime),
                endTime: new Date(booking.endTime),
                meetingLink: booking.meetingLink || booking.meeting_link || undefined,
              }));
              setBookings(formattedBookings);
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

  return { bookings, isConnected, error };
}

