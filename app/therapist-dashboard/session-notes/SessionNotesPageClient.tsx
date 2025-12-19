"use client";

import { useState } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { BottomNavigation } from "@/components/layout/bottom-navigation";
import { Button } from "@/components/ui/button";
import { FillNotesModal } from "./FillNotesModal";
import { ClientDetailsModal } from "./ClientDetailsModal";
import { FileText, Clock, Users } from "lucide-react";

interface SessionNote {
  id: string;
  booking_id: string;
  therapist_id: string;
  client_id: string;
  client_name: string;
  session_number: number;
  session_date: string;
  session_time: string;
  therapist_name: string;
  location: string;
  patient_complaint?: string;
  personal_history?: string;
  family_history?: string;
  presentation?: string;
  formulation_and_diagnosis?: string;
  treatment_plan?: string;
  assignments?: string;
  status: "PENDING" | "COMPLETED";
  created_at: string;
  updated_at: string;
  completed_at?: string;
  bookings?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    booking_status: string;
  };
  client?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Client {
  id: string;
  name: string;
  email: string;
  totalSessions: number;
  lastSessionDate: Date | null;
}

interface SessionNotesPageClientProps {
  pendingNotes: SessionNote[];
  clients: Client[];
  therapistName: string;
}

export default function SessionNotesPageClient({
  pendingNotes: initialPendingNotes,
  clients: initialClients,
  therapistName,
}: SessionNotesPageClientProps) {
  const [pendingNotes, setPendingNotes] = useState(initialPendingNotes);
  const [clients] = useState(initialClients);
  const [selectedNote, setSelectedNote] = useState<SessionNote | null>(null);
  const [isFillNotesModalOpen, setIsFillNotesModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isClientDetailsModalOpen, setIsClientDetailsModalOpen] =
    useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "clients">("pending");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  const handleFillNotes = (note: SessionNote) => {
    setSelectedNote(note);
    setIsFillNotesModalOpen(true);
  };

  const handleViewClientDetails = (clientId: string) => {
    setSelectedClientId(clientId);
    setIsClientDetailsModalOpen(true);
  };

  const handleNoteSaved = (updatedNote?: SessionNote) => {
    if (!updatedNote) return;
    // Remove from pending, add to clients if completed
    setPendingNotes((prev) =>
      prev.filter((note) => note.id !== updatedNote.id)
    );
    setIsFillNotesModalOpen(false);
    setSelectedNote(null);
    // Refresh the page to update clients list
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader />
      </div>

      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main Content */}
      <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg pb-16 lg:pb-0">
        <div className="p-6 lg:p-8 pt-14 lg:pt-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">
              Session Notes
            </h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Document and manage your client session notes.
            </p>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-[#262626] mb-6">
              <button
                onClick={() => setActiveTab("pending")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "pending"
                    ? "border-white text-[#f9fafb]"
                    : "border-transparent text-[#9ca3af] hover:text-[#f9fafb]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending Notes ({pendingNotes.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab("clients")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "clients"
                    ? "border-white text-[#f9fafb]"
                    : "border-transparent text-[#9ca3af] hover:text-[#f9fafb]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Clients ({clients.length})
                </div>
              </button>
            </div>
          </div>

          {/* Pending Notes Section */}
          {activeTab === "pending" && (
            <div className="space-y-4">
              {pendingNotes.length === 0 ? (
                <div className="text-center py-12 text-[#9ca3af]">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending session notes</p>
                </div>
              ) : (
                pendingNotes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-[#171717] border border-[#262626] rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-[#f9fafb] font-medium mb-2">
                          {note.client_name}
                        </h3>
                        <div className="space-y-1 text-sm text-[#9ca3af]">
                          <p>
                            Session {note.session_number} • {formatDate(note.session_date)} •{" "}
                            {formatTime(note.session_time)}
                          </p>
                          {note.bookings && (
                            <p className="text-xs">{note.bookings.title}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleFillNotes(note)}
                        className="bg-white hover:bg-gray-100 text-black px-4 py-2 text-sm font-medium"
                      >
                        Fill Notes
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Clients Section */}
          {activeTab === "clients" && (
            <div className="space-y-4">
              {clients.length === 0 ? (
                <div className="text-center py-12 text-[#9ca3af]">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No clients with completed notes</p>
                </div>
              ) : (
                clients.map((client) => (
                  <div
                    key={client.id}
                    className="bg-[#171717] border border-[#262626] rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-[#f9fafb] font-medium mb-2">
                          {client.name}
                        </h3>
                        <div className="space-y-1 text-sm text-[#9ca3af]">
                          <p>Total Sessions: {client.totalSessions}</p>
                          {client.lastSessionDate && (
                            <p>
                              Last Session:{" "}
                              {formatDate(client.lastSessionDate.toISOString())}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleViewClientDetails(client.id)}
                        variant="outline"
                        className="bg-transparent border-[#404040] text-[#f9fafb] hover:bg-[#262626] px-4 py-2 text-sm font-medium"
                      >
                        View Client Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />

      {/* Modals */}
      {selectedNote && (
        <FillNotesModal
          isOpen={isFillNotesModalOpen}
          onClose={() => {
            setIsFillNotesModalOpen(false);
            setSelectedNote(null);
          }}
          note={selectedNote}
          onSave={handleNoteSaved}
        />
      )}

      {selectedClientId && (
        <ClientDetailsModal
          isOpen={isClientDetailsModalOpen}
          onClose={() => {
            setIsClientDetailsModalOpen(false);
            setSelectedClientId(null);
          }}
          clientId={selectedClientId}
        />
      )}
    </div>
  );
}

