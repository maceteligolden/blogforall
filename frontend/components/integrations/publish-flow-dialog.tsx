"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { PublishDestinationPicker } from "@/components/integrations/publish-destination-picker";
import type { PublishDestinationOption } from "@/lib/api/services/integration.service";

export type PublishFlowMode = "publish" | "schedule";

export function PublishFlowDialog({
  isOpen,
  mode,
  title,
  destinations,
  selected,
  onChange,
  scheduleAt,
  onScheduleAtChange,
  pending,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  mode: PublishFlowMode;
  title?: string;
  destinations: PublishDestinationOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  scheduleAt?: string;
  onScheduleAtChange?: (next: string) => void;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const confirmDisabled = pending || selected.length === 0 || (mode === "schedule" && !scheduleAt);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !pending && onClose()}
      title={mode === "schedule" ? "Schedule post" : "Publish post"}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
            className="border-gray-700 text-gray-300"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {pending
              ? mode === "schedule"
                ? "Scheduling…"
                : "Publishing…"
              : mode === "schedule"
                ? "Schedule"
                : "Publish"}
          </Button>
        </div>
      }
    >
      {title && <p className="text-sm text-white mb-3 line-clamp-2">{title}</p>}
      <p className="text-sm text-gray-400 mb-4">
        {mode === "schedule"
          ? "Choose when and where this post should go live."
          : "Choose where this post should go live."}
      </p>
      {mode === "schedule" && onScheduleAtChange && (
        <DateTimePicker
          id="publish-flow-schedule-at"
          value={scheduleAt ?? ""}
          onChange={onScheduleAtChange}
          min={new Date().toISOString().slice(0, 16)}
          aria-label="Schedule date and time"
          className="mb-4 w-full"
        />
      )}
      <PublishDestinationPicker
        destinations={destinations}
        selected={selected}
        onChange={onChange}
        disabled={pending}
      />
    </Modal>
  );
}
