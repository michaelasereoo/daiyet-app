"use client";

import { useEffect, useState } from "react";

export default function DebugSessionStatePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/debug/user-session-state", {
          credentials: "include",
        });
        const json = await response.json();
        if (response.ok) {
          setData(json);
        } else {
          setError(json.error || "Failed to fetch data");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-4">Loading debug data...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">User Session State Debug</h1>
        
        {/* Summary */}
        {data?.summary && (
          <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-[#9ca3af]">Total Session Requests</div>
                <div className="text-2xl font-bold text-white">{data.summary.totalSessionRequests}</div>
              </div>
              <div>
                <div className="text-sm text-[#9ca3af]">Pending</div>
                <div className="text-2xl font-bold text-yellow-400">{data.summary.pendingSessionRequests}</div>
              </div>
              <div>
                <div className="text-sm text-[#9ca3af]">Approved</div>
                <div className="text-2xl font-bold text-green-400">{data.summary.approvedSessionRequests}</div>
              </div>
              <div>
                <div className="text-sm text-[#9ca3af]">Total Bookings</div>
                <div className="text-2xl font-bold text-white">{data.summary.totalBookings}</div>
              </div>
              <div>
                <div className="text-sm text-[#9ca3af]">Confirmed</div>
                <div className="text-2xl font-bold text-green-400">{data.summary.confirmedBookings}</div>
              </div>
              <div>
                <div className="text-sm text-[#9ca3af]">With Meeting Links</div>
                <div className="text-2xl font-bold text-blue-400">{data.summary.bookingsWithMeetingLinks}</div>
              </div>
              <div>
                <div className="text-sm text-[#9ca3af]">Upcoming</div>
                <div className="text-2xl font-bold text-purple-400">{data.summary.upcomingBookings}</div>
              </div>
            </div>
          </div>
        )}

        {/* Session Requests */}
        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Session Requests ({data?.sessionRequests?.length || 0})
          </h2>
          <div className="space-y-4">
            {data?.sessionRequests?.map((sr: any) => (
              <div
                key={sr.id}
                className={`border rounded-lg p-4 ${
                  sr.status === "APPROVED"
                    ? "border-green-500 bg-green-500/10"
                    : sr.status === "PENDING"
                    ? "border-yellow-500 bg-yellow-500/10"
                    : "border-[#262626] bg-transparent"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-white font-semibold">
                      {sr.requestType} - {sr.status}
                    </div>
                    <div className="text-sm text-[#9ca3af]">ID: {sr.id}</div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      sr.status === "APPROVED"
                        ? "bg-green-500 text-white"
                        : sr.status === "PENDING"
                        ? "bg-yellow-500 text-black"
                        : "bg-gray-500 text-white"
                    }`}
                  >
                    {sr.status}
                  </span>
                </div>
                <div className="text-sm text-[#9ca3af] space-y-1">
                  <div>Dietitian: {sr.dietitian?.name || sr.dietitian?.email || "N/A"}</div>
                  {sr.eventType && <div>Event: {sr.eventType.title}</div>}
                  {sr.mealPlanType && <div>Meal Plan: {sr.mealPlanType}</div>}
                  <div>Created: {new Date(sr.createdAt).toLocaleString()}</div>
                  <div>Updated: {new Date(sr.updatedAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings */}
        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Bookings ({data?.bookings?.length || 0})
          </h2>
          <div className="space-y-4">
            {data?.bookings?.map((booking: any) => (
              <div
                key={booking.id}
                className={`border rounded-lg p-4 ${
                  booking.status === "CONFIRMED"
                    ? "border-green-500 bg-green-500/10"
                    : "border-[#262626] bg-transparent"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-white font-semibold">
                      {booking.title} - {booking.status}
                    </div>
                    <div className="text-sm text-[#9ca3af]">ID: {booking.id}</div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      booking.status === "CONFIRMED"
                        ? "bg-green-500 text-white"
                        : booking.status === "PENDING"
                        ? "bg-yellow-500 text-black"
                        : "bg-gray-500 text-white"
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
                <div className="text-sm text-[#9ca3af] space-y-1">
                  <div>
                    Date: {new Date(booking.startTime).toLocaleString()} -{" "}
                    {new Date(booking.endTime).toLocaleString()}
                  </div>
                  {booking.eventType && <div>Event: {booking.eventType.title}</div>}
                  <div>Dietitian: {booking.dietitian?.name || booking.dietitian?.email || "N/A"}</div>
                  {booking.meetingLink ? (
                    <div className="text-blue-400">
                      Meeting Link:{" "}
                      <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer" className="underline">
                        {booking.meetingLink}
                      </a>
                    </div>
                  ) : (
                    <div className="text-yellow-400">⚠️ No meeting link</div>
                  )}
                  {booking.payment && (
                    <div>
                      Payment: {booking.payment.status} - ₦{booking.payment.amount} {booking.payment.currency}
                    </div>
                  )}
                  <div>Created: {new Date(booking.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Raw JSON */}
        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4">Raw JSON</h2>
          <pre className="bg-[#0a0a0a] p-4 rounded text-xs text-[#9ca3af] overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

