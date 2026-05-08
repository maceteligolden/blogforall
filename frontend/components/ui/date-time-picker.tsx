"use client";

import { useState, useEffect, useRef, useMemo, KeyboardEvent } from "react";
import {
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfDay,
  isBefore,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

export interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  format12h?: boolean;
  className?: string;
  "aria-label"?: string;
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const parsed = parse(value, DATETIME_LOCAL_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

function toDateTimeLocal(date: Date): string {
  return format(date, DATETIME_LOCAL_FORMAT);
}

function clamp(date: Date, min?: Date): Date {
  if (min && isBefore(date, min)) return min;
  return date;
}

export function DateTimePicker({
  value,
  onChange,
  min,
  disabled,
  id,
  placeholder = "Select date and time",
  format12h = true,
  className,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const minDate = useMemo(() => parseDateTimeLocal(min ?? ""), [min]);
  const selectedDate = useMemo(() => parseDateTimeLocal(value), [value]);

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(selectedDate ?? minDate ?? new Date());
  const [draftDate, setDraftDate] = useState<Date | null>(selectedDate);
  const [hourInput, setHourInput] = useState<string>("");
  const [minuteInput, setMinuteInput] = useState<string>("");
  const [meridiem, setMeridiem] = useState<"AM" | "PM">("AM");
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const seed = selectedDate ?? minDate ?? new Date();
    setDraftDate(selectedDate);
    setViewMonth(seed);
    setError(null);
    syncTimeInputsFromDate(selectedDate ?? seed, format12h);
  }, [open, selectedDate, minDate, format12h]);

  function syncTimeInputsFromDate(date: Date, twelveHour: boolean) {
    const h = date.getHours();
    const m = date.getMinutes();
    if (twelveHour) {
      const isPm = h >= 12;
      const h12 = h % 12 === 0 ? 12 : h % 12;
      setHourInput(String(h12));
      setMeridiem(isPm ? "PM" : "AM");
    } else {
      setHourInput(String(h).padStart(2, "0"));
      setMeridiem("AM");
    }
    setMinuteInput(String(m).padStart(2, "0"));
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarStart, calendarEnd]
  );

  const minDay = minDate ? startOfDay(minDate) : null;

  const triggerLabel = selectedDate ? format(selectedDate, "PPp") : placeholder;

  const handleSelectDay = (day: Date) => {
    if (minDay && isBefore(day, minDay)) return;
    const base = draftDate ?? selectedDate ?? new Date();
    const next = setMilliseconds(
      setSeconds(
        setMinutes(setHours(day, base.getHours()), base.getMinutes()),
        0
      ),
      0
    );
    setDraftDate(next);
    setError(null);
  };

  const handleApply = () => {
    if (!draftDate) {
      setError("Pick a date first");
      return;
    }

    const h = parseInt(hourInput, 10);
    const m = parseInt(minuteInput, 10);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      setError("Enter a valid time");
      return;
    }
    if (m < 0 || m > 59) {
      setError("Minutes must be 00-59");
      return;
    }

    let hour24: number;
    if (format12h) {
      if (h < 1 || h > 12) {
        setError("Hour must be 1-12");
        return;
      }
      hour24 = meridiem === "PM" ? (h % 12) + 12 : h % 12;
    } else {
      if (h < 0 || h > 23) {
        setError("Hour must be 0-23");
        return;
      }
      hour24 = h;
    }

    let combined = setMilliseconds(
      setSeconds(setMinutes(setHours(draftDate, hour24), m), 0),
      0
    );

    if (minDate && isBefore(combined, minDate)) {
      combined = clamp(combined, minDate);
      setError("Time was earlier than the minimum and was bumped forward");
    }

    onChange(toDateTimeLocal(combined));
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "BUTTON") {
        e.preventDefault();
        handleApply();
      }
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? "Pick date and time"}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-left",
          "text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selectedDate && "text-gray-400"
        )}
      >
        <CalendarIcon className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">{triggerLabel}</span>
        {selectedDate && !disabled && (
          <span
            role="button"
            aria-label="Clear date"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange("");
                setOpen(false);
              }
            }}
            className="rounded p-0.5 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Date and time picker"
          onKeyDown={handleKey}
          className="absolute left-0 z-[10000] mt-2 w-80 rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
              className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="text-sm font-semibold text-white">
              {format(viewMonth, "MMMM yyyy")}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMonth(new Date())}
                className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
                className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-gray-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = isSameMonth(day, viewMonth);
              const isSelected = draftDate ? isSameDay(day, draftDate) : false;
              const isToday = isSameDay(day, new Date());
              const isDisabled = minDay ? isBefore(day, minDay) : false;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  disabled={isDisabled}
                  aria-label={format(day, "PPP")}
                  aria-pressed={isSelected}
                  className={cn(
                    "h-8 w-full rounded text-xs transition-colors",
                    "text-gray-300 hover:bg-gray-800 hover:text-white",
                    !inMonth && "opacity-40",
                    isToday && !isSelected && "ring-1 ring-primary/40",
                    isSelected && "bg-primary text-white hover:bg-primary/90",
                    isDisabled && "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-gray-300"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-gray-400">Time</span>
            <input
              type="number"
              min={format12h ? 1 : 0}
              max={format12h ? 12 : 23}
              value={hourInput}
              onChange={(e) => setHourInput(e.target.value)}
              aria-label="Hour"
              className="h-9 w-14 rounded border border-gray-700 bg-black px-2 text-center text-sm text-white focus:border-primary focus:outline-none"
            />
            <span className="text-gray-400">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={minuteInput}
              onChange={(e) => setMinuteInput(e.target.value)}
              aria-label="Minute"
              className="h-9 w-14 rounded border border-gray-700 bg-black px-2 text-center text-sm text-white focus:border-primary focus:outline-none"
            />
            {format12h && (
              <div className="flex overflow-hidden rounded border border-gray-700">
                <button
                  type="button"
                  onClick={() => setMeridiem("AM")}
                  aria-pressed={meridiem === "AM"}
                  className={cn(
                    "h-9 px-2 text-xs",
                    meridiem === "AM" ? "bg-primary text-white" : "bg-black text-gray-300 hover:bg-gray-800"
                  )}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setMeridiem("PM")}
                  aria-pressed={meridiem === "PM"}
                  className={cn(
                    "h-9 px-2 text-xs",
                    meridiem === "PM" ? "bg-primary text-white" : "bg-black text-gray-300 hover:bg-gray-800"
                  )}
                >
                  PM
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!draftDate}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
