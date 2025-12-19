"use client";

import { useState, useEffect } from "react";
import { FillNotesForm } from "@/components/session-notes/FillNotesForm";
import { X } from "lucide-react";

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
}

interface FillNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  note?: SessionNote;
  noteId?: string;
  onSave: (updatedNote?: SessionNote) => void;
}

export function FillNotesModal({
  isOpen,
  onClose,
  note: initialNote,
  noteId,
  onSave,
}: FillNotesModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [note, setNote] = useState<SessionNote | null>(initialNote || null);
  const [isLoadingNote, setIsLoadingNote] = useState(false);

  // Fetch note if only noteId is provided
  useEffect(() => {
    if (isOpen && noteId && !note) {
      setIsLoadingNote(true);
      fetch(`/api/session-notes/${noteId}`)
        .then((res) => res.json())
        .then((data) => {
          setNote(data.note);
          setIsLoadingNote(false);
        })
        .catch((err) => {
          console.error("Error fetching note:", err);
          setIsLoadingNote(false);
        });
    }
  }, [isOpen, noteId, note]);

  if (!isOpen) return null;

  if (isLoadingNote || !note) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-6">
          <p className="text-[#f9fafb]">Loading note...</p>
        </div>
      </div>
    );
  }

  const handleSave = async (formData: Partial<SessionNote>) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/session-notes/${note.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save notes");
      }

      const { note: updatedNote } = await response.json();
      onSave(updatedNote);
    } catch (error: any) {
      console.error("Error saving notes:", error);
      alert(error.message || "Failed to save notes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0a0a0a] border-b border-[#262626] p-6 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-[#f9fafb]">
            Fill Session Notes
          </h2>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#f9fafb] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <FillNotesForm
            note={note}
            onSave={handleSave}
            onCancel={onClose}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

