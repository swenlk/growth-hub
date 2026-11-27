"use client";

import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type DragEvent, type SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes, formatDuration } from "@/lib/format";

export type PendingVideo = {
  key: string;
  file: File;
  duration: number | null;
  error: string | null;
};

export type SavedVideo = {
  storedFileName: string;
  originalFileName: string;
  durationSeconds: number;
  sizeBytes: number;
};

export type VideoStrip =
  | { kind: "saved"; video: SavedVideo }
  | { kind: "pending"; video: PendingVideo };

function isAllowedVideo(file: File): boolean {
  const name = file.name.toLowerCase();
  const extensionOk = name.endsWith(".mp4") || name.endsWith(".webm");
  const typeOk = file.type === "" || file.type === "video/mp4" || file.type === "video/webm";
  return extensionOk && typeOk;
}

function stripKey(strip: VideoStrip): string {
  return strip.kind === "saved" ? strip.video.storedFileName : strip.video.key;
}

function reorder(items: VideoStrip[], from: number, to: number): VideoStrip[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (!moved) return items;
  next.splice(to, 0, moved);
  return next;
}

function useVideoDurations(strips: VideoStrip[], setStrips: Dispatch<SetStateAction<VideoStrip[]>>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stripsRef = useRef(strips);
  stripsRef.current = strips;
  const pending = strips.find(
    (strip): strip is Extract<VideoStrip, { kind: "pending" }> =>
      strip.kind === "pending" && strip.video.duration === null && !strip.video.error,
  );
  const currentKey = pending?.video.key ?? null;

  useEffect(() => {
    const video = videoRef.current;
    const strip = stripsRef.current.find((item) => item.kind === "pending" && item.video.key === currentKey);
    if (!video || !strip || strip.kind !== "pending") return;

    const url = URL.createObjectURL(strip.video.file);
    let settled = false;
    const finish = (duration: number | null, error: string | null) => {
      if (settled) return;
      settled = true;
      setStrips((items) =>
        items.map((item) =>
          item.kind === "pending" && item.video.key === currentKey
            ? { kind: "pending", video: { ...item.video, duration, error } }
            : item,
        ),
      );
    };
    const onReady = () => {
      const value = video.duration;
      if (!Number.isFinite(value) || value <= 0) {
        finish(null, "Could not read the video length. Use an mp4 or webm file.");
        return;
      }
      finish(value, null);
    };
    const onFail = () => finish(null, "Could not read the video length. Use an mp4 or webm file.");

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("error", onFail);
    video.src = url;
    video.load();

    return () => {
      settled = true;
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("error", onFail);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [currentKey, setStrips]);

  return videoRef;
}

export function VideoField({
  strips,
  setStrips,
  disabled,
  onPickError,
}: {
  strips: VideoStrip[];
  setStrips: Dispatch<SetStateAction<VideoStrip[]>>;
  disabled: boolean;
  onPickError: (message: string | null) => void;
}) {
  const videoRef = useVideoDurations(strips, setStrips);
  const dragFrom = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...(event.target.files ?? [])];
    event.target.value = "";
    if (selected.length === 0) return;

    const accepted: VideoStrip[] = [];
    let rejected = false;
    for (const file of selected) {
      if (!isAllowedVideo(file)) {
        rejected = true;
        continue;
      }
      accepted.push({ kind: "pending", video: { key: crypto.randomUUID(), file, duration: null, error: null } });
    }

    if (rejected) onPickError("Use an mp4 or webm video");
    else onPickError(null);

    if (accepted.length > 0) setStrips((items) => [...items, ...accepted]);
  }

  function onDragStart(event: DragEvent<HTMLLIElement>, index: number) {
    dragFrom.current = index;
    setDragging(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function onDragOver(event: DragEvent<HTMLLIElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onDrop(event: DragEvent<HTMLLIElement>, index: number) {
    event.preventDefault();
    const from = dragFrom.current;
    dragFrom.current = null;
    setDragging(null);
    if (from === null) return;
    setStrips((items) => reorder(items, from, index));
  }

  function onDragEnd() {
    dragFrom.current = null;
    setDragging(null);
  }

  return (
    <div className="grid content-start gap-2">
      <label className="grid gap-2 text-sm font-medium">
        Videos
        <Input
          type="file"
          multiple
          accept="video/mp4,video/webm,.mp4,.webm"
          onChange={onPick}
          disabled={disabled}
        />
      </label>
      <p className="text-sm font-normal text-neutral-500 dark:text-neutral-300">
        mp4 or webm. Drag a strip to change the order.
      </p>
      {strips.length > 0 ? (
        <ul className="space-y-2">
          {strips.map((strip, index) => {
            const name = strip.kind === "saved" ? strip.video.originalFileName : strip.video.file.name;
            const detail =
              strip.kind === "saved"
                ? `${formatDuration(strip.video.durationSeconds)} · ${formatBytes(strip.video.sizeBytes)}`
                : strip.video.error
                  ? strip.video.error
                  : strip.video.duration === null
                    ? "Reading length…"
                    : `${formatDuration(strip.video.duration)} · ${formatBytes(strip.video.file.size)}`;
            return (
              <li
                key={stripKey(strip)}
                draggable={!disabled}
                onDragStart={(event) => onDragStart(event, index)}
                onDragOver={onDragOver}
                onDrop={(event) => onDrop(event, index)}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-slate-600 ${
                  disabled ? "" : "cursor-grab active:cursor-grabbing"
                } ${dragging === index ? "opacity-60" : ""}`}
              >
                <GripVertical className="size-4 shrink-0 text-neutral-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{name}</span>
                  <span className="text-neutral-500 dark:text-neutral-300">{detail}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  draggable={false}
                  disabled={disabled}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => setStrips((items) => items.filter((item) => stripKey(item) !== stripKey(strip)))}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-300">No videos yet.</p>
      )}
      <video ref={videoRef} preload="metadata" className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden />
    </div>
  );
}
