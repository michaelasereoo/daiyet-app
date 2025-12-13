"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, ChevronDown } from "lucide-react";

export default function GeneralPage() {
  const [language, setLanguage] = useState("English");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [timeFormat, setTimeFormat] = useState("12 hour");
  const [startOfWeek, setStartOfWeek] = useState("Sunday");
  const [dynamicGroupLinks, setDynamicGroupLinks] = useState(true);
  const [searchEngineIndexing, setSearchEngineIndexing] = useState(true);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-[#f9fafb] mb-1">General</h1>
        <p className="text-sm text-[#9ca3af]">
          Manage settings for your language and timezone
        </p>
      </div>

      <div className="space-y-8 max-w-3xl">
        {/* Language */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Language
          </label>
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled
              className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040] opacity-50 cursor-not-allowed"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Timezone
          </label>
          <div className="relative">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled
              className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040] opacity-50 cursor-not-allowed"
            >
              <option value="Africa/Lagos">Africa/Lagos</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
          </div>
          <Button
            variant="outline"
            disabled
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2 opacity-50 cursor-not-allowed"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule timezone change
          </Button>
        </div>

        {/* Time Format */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Time format
          </label>
          <div className="relative">
            <select
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value)}
              disabled
              className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040] opacity-50 cursor-not-allowed"
            >
              <option value="12 hour">12 hour</option>
              <option value="24 hour">24 hour</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
          </div>
          <p className="text-xs text-[#9ca3af]">
            This is an internal setting and will not affect how times are displayed on public booking pages for you or anyone booking you.
          </p>
        </div>

        {/* Start of Week */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#D4D4D4]">
            Start of week
          </label>
          <div className="relative">
            <select
              value={startOfWeek}
              onChange={(e) => setStartOfWeek(e.target.value)}
              disabled
              className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040] opacity-50 cursor-not-allowed"
            >
              <option value="Sunday">Sunday</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
          </div>
        </div>

        {/* Update Button */}
        <div>
          <Button disabled className="bg-[#404040] hover:bg-[#525252] text-[#f9fafb] px-4 py-2 opacity-50 cursor-not-allowed">
            Update
          </Button>
        </div>

        {/* Divider */}
        <div className="border-t border-[#262626] pt-8"></div>

        {/* Dynamic Group Links Toggle */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-[#f9fafb] mb-1">
              Dynamic group links
            </h3>
            <p className="text-sm text-[#9ca3af]">
              Allow attendees to book you through dynamic group bookings.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-not-allowed ml-4 opacity-50">
            <input
              type="checkbox"
              checked={dynamicGroupLinks}
              onChange={(e) => setDynamicGroupLinks(e.target.checked)}
              disabled
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9ca3af]"></div>
          </label>
        </div>

        {/* Search Engine Indexing Toggle */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-[#f9fafb] mb-1">
              Allow search engine indexing
            </h3>
            <p className="text-sm text-[#9ca3af]">
              Allow search engines to access your public content.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-not-allowed ml-4 opacity-50">
            <input
              type="checkbox"
              checked={searchEngineIndexing}
              onChange={(e) => setSearchEngineIndexing(e.target.checked)}
              disabled
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9ca3af]"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
