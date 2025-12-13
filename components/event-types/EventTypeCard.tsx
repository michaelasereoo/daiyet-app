"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Share2, Copy as CopyIcon, MoreVertical } from "lucide-react";

interface EventTypeCardProps {
  id: string;
  title: string;
  slug: string;
  description: string;
  duration: number;
  price: number;
  currency?: string;
  guests?: number;
  isActive?: boolean;
  isHidden?: boolean;
  dietitianName?: string;
}

interface EventTypeCardProps {
  id: string;
  title: string;
  slug: string;
  description: string;
  duration: number;
  price: number;
  currency?: string;
  guests?: number;
  isActive?: boolean;
  isHidden?: boolean;
  dietitianName?: string;
}

export function EventTypeCard({
  id,
  title,
  slug,
  description,
  duration,
  price,
  currency = "₦",
  guests = 1,
  isActive = false,
  isHidden = false,
  dietitianName = "dietitian",
}: EventTypeCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isToggled, setIsToggled] = useState(isActive);
  const [updating, setUpdating] = useState(false);

  const handleCardClick = () => {
    router.push(`/dashboard/event-types/${id}`);
  };

  const handleToggleChange = async (checked: boolean) => {
    setIsToggled(checked);
    setUpdating(true);
    
    try {
      const response = await fetch(`/api/event-types/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          active: checked,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update event type");
      }
    } catch (err) {
      console.error("Error updating event type:", err);
      setIsToggled(!checked); // Revert on error
      alert(err instanceof Error ? err.message : "Failed to update event type");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div 
      className="w-full border border-[#262626] rounded-lg px-6 py-4 transition-colors mb-4 cursor-pointer"
      style={{ 
        backgroundColor: isHovered || isActive ? '#171717' : 'transparent'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h3 className="font-medium text-[#f9fafb] text-[14px]">{title}</h3>
            <p className="text-sm text-[#A2A2A2]">/daiyet.co/{dietitianName}/{slug}</p>
            {isHidden && (
              <span className="text-sm text-[#9ca3af]">Hidden</span>
            )}
          </div>
          {description && (
            <p className="text-sm text-[#d1d5db] leading-relaxed mb-3">{description}</p>
          )}
          {/* Time Indicator - positioned after description */}
          <div className="flex items-center gap-1.5 bg-[#404040] px-2.5 py-1 rounded-md w-fit">
            <Clock className="h-4 w-4 text-[#D4D4D4]" />
            <span className="text-sm text-[#D4D4D4] font-medium">{duration}m</span>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-6">
          {/* Toggle Switch */}
          <label 
            className="relative inline-flex items-center cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isToggled}
              onChange={(e) => handleToggleChange(e.target.checked)}
              disabled={updating}
              className="sr-only peer"
            />
            <div className={`w-11 h-6 bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9ca3af] ${updating ? 'opacity-50' : ''}`}></div>
          </label>

          {/* Action Icons */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors">
              <Share2 className="h-5 w-5" />
            </button>
            <button className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors">
              <CopyIcon className="h-5 w-5" />
            </button>
            <button className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
