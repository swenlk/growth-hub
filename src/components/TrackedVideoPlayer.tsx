"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { watchedPercent } from "@/lib/assignment-view";
import type { WatchedRange } from "@/lib/domain";
import { allowedWatchSeconds, continuousSpan, mergeRanges, MAX_PLAYBACK_RATE, sumRanges } from "@/lib/progress";

type ProgressState = {
  watchedSeconds: number;
  watchedPercent: number;
  lastPositionSeconds: number;
  videoCompleted: boolean;
  watchedRanges?: WatchedRange[];
};

type OpenRange = { from: number; to: number };
type AssignmentStatus = "assigned" | "in_progress" | "completed";

export function TrackedVideoPlayer({
  assignmentId,
  courseId,
  durationSeconds,
  initial,
  initialStatus,
}: {
  assignmentId: string;
  courseId: string;
  durationSeconds: number;
  initial: ProgressState;
  initialStatus: AssignmentStatus;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAtRef = useRef(initial.lastPositionSeconds);
  const completedRef = useRef(initial.videoCompleted);
  const rangesRef = useRef<WatchedRange[]>(seedRanges(initial));
  const flushRef = useRef<(beacon: boolean) => Promise<void>>(async () => undefined);
  const [progress, setProgress] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    resumeAtRef.current = progress.lastPositionSeconds;
    completedRef.current = progress.videoCompleted;
  }, [progress.lastPositionSeconds, progress.videoCompleted]);

  useEffect(() => {
    let cancel = false;
    void fetch(`/api/assignments/${assignmentId}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { status?: AssignmentStatus; progress?: ProgressState };
      })
      .then((body) => {
        if (cancel || !body?.progress) return;
        const saved = seedRanges(body.progress);
        rangesRef.current = mergeRanges([...rangesRef.current, ...saved]);
        const savedSeconds = sumRanges(rangesRef.current);
        setProgress((current) => {
          const watchedSeconds = Math.max(current.watchedSeconds, savedSeconds);
          return {
            ...current,
            ...body.progress,
            watchedSeconds,
            watchedPercent: watchedPercent(watchedSeconds, durationSeconds),
            videoCompleted: current.videoCompleted || body.progress?.videoCompleted || false,
          };
        });
        if (body.status) setStatus(body.status);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [assignmentId, durationSeconds]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return undefined;
    return watch(element);

    function watch(video: HTMLVideoElement) {

    const sample: { current: { media: number; wall: number } | null } = { current: null };
    const open: { current: OpenRange | null } = { current: null };
    const backlog: OpenRange[] = [];
    let lastAcceptedAt: Date | undefined;
    let resumed = false;
    let inflight = false;
    let retry: number | null = null;

    function paint(position: number) {
      const pending = backlog.flatMap((range) => (range.to > range.from ? [[range.from, range.to] as WatchedRange] : []));
      const live =
        open.current && open.current.to > open.current.from
          ? [[open.current.from, open.current.to] as WatchedRange]
          : [];
      const watchedSeconds = sumRanges(mergeRanges([...rangesRef.current, ...pending, ...live]));
      setProgress((current) => ({
        ...current,
        watchedSeconds,
        watchedPercent: watchedPercent(watchedSeconds, durationSeconds),
        lastPositionSeconds: position,
      }));
    }

    function remember(range: OpenRange | null) {
      if (!range || range.to <= range.from + 0.2) return;
      const last = backlog[backlog.length - 1];
      if (last && range.from <= last.to + 0.05 && range.to >= last.from - 0.05) {
        last.from = Math.min(last.from, range.from);
        last.to = Math.max(last.to, range.to);
        return;
      }
      backlog.push({ from: range.from, to: range.to });
    }

    function scheduleRetry() {
      if (retry !== null) return;
      retry = window.setTimeout(() => {
        retry = null;
        void sendOpen(false);
      }, 1000);
    }

    function clip(range: OpenRange): OpenRange | null {
      const room = allowedWatchSeconds(lastAcceptedAt, new Date()) - 0.2;
      const length = range.to - range.from;
      if (length <= 0.2 || room < 0.3) return null;
      const to = length <= room ? range.to : range.from + room;
      return { from: range.from, to: round3(to) };
    }

    function restore(range: OpenRange) {
      remember(range);
    }

    async function postRange(range: OpenRange, position: number, beacon: boolean): Promise<boolean> {
      const body = {
        from: fit(range.from, durationSeconds),
        to: fit(range.to, durationSeconds),
        position: fit(position, durationSeconds),
      };
      if (!(body.to > body.from)) return false;
      const url = `/api/assignments/${assignmentId}/progress`;
      const acceptedAt = new Date();
      const previousAccepted = lastAcceptedAt;
      lastAcceptedAt = acceptedAt;
      if (beacon) {
        const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
        if (!navigator.sendBeacon(url, blob)) {
          lastAcceptedAt = previousAccepted;
          restore(range);
          return false;
        }
        return true;
      }
      inflight = true;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          progress?: ProgressState;
          status?: AssignmentStatus;
        } | null;
        if (!response.ok || !payload?.progress) {
          if (lastAcceptedAt === acceptedAt) lastAcceptedAt = previousAccepted;
          restore(range);
          setNotice(payload?.error ?? "Progress could not be saved");
          return false;
        }
        const saved = seedRanges(payload.progress);
        rangesRef.current = mergeRanges([...rangesRef.current, ...saved]);
        const watchedSeconds = sumRanges(
          mergeRanges([
            ...rangesRef.current,
            ...backlog.map((range) => [range.from, range.to] as WatchedRange),
            ...(open.current && open.current.to > open.current.from
              ? [[open.current.from, open.current.to] as WatchedRange]
              : []),
          ]),
        );
        setProgress((current) => ({
          ...current,
          ...payload.progress,
          watchedSeconds,
          watchedPercent: watchedPercent(watchedSeconds, durationSeconds),
          videoCompleted: current.videoCompleted || payload.progress?.videoCompleted || false,
        }));
        if (payload.status) setStatus(payload.status);
        setNotice(null);
        return true;
      } finally {
        inflight = false;
      }
    }

    function sendOpen(beacon: boolean): Promise<void> {
      if (inflight && !beacon) return Promise.resolve();
      const end = sample.current?.media ?? video.currentTime;
      if (open.current) {
        const to = Math.min(end, open.current.to, durationSeconds);
        if (to > open.current.from + 0.2) {
          remember({ from: open.current.from, to });
          const playing = !video.paused && !video.ended;
          open.current = playing ? { from: to, to: Math.max(to, end) } : null;
        }
      }
      const pending = backlog[0];
      if (!pending) return Promise.resolve();
      const sending = clip(pending);
      if (!sending) {
        scheduleRetry();
        return Promise.resolve();
      }
      if (sending.to >= pending.to - 0.05) backlog.shift();
      else pending.from = sending.to;
      return postRange(sending, sending.to, beacon).then(() => undefined);
    }

    function onTimeUpdate() {
      const media = video.currentTime;
      const wall = performance.now();
      const previous = sample.current;
      sample.current = { media, wall };
      if (!previous) {
        open.current = { from: media, to: media };
        return;
      }
      const elapsed = (wall - previous.wall) / 1000;
      const rate = Math.min(Math.max(video.playbackRate, 1), MAX_PLAYBACK_RATE);
      const span =
        continuousSpan(previous.media, media, elapsed) ??
        (media - previous.media <= elapsed * rate + 0.75 ? { from: previous.media, to: media } : null);
      if (!span) {
        const closed =
          open.current && previous.media > open.current.from + 0.2
            ? { from: open.current.from, to: Math.min(previous.media, open.current.to) }
            : null;
        remember(closed);
        open.current = { from: media, to: media };
        if (media > previous.media + 1) {
          setNotice("Skipping ahead does not count as watched. Playback has to run through the video.");
        }
        if (closed) void sendOpen(false);
        return;
      }
      if (!open.current || span.from > open.current.to + 0.05) {
        open.current = { from: span.from, to: span.to };
      } else {
        open.current.to = span.to;
      }
      paint(media);
    }

    function onLoadedMetadata() {
      if (resumed) return;
      resumed = true;
      const resumeAt = resumeAtRef.current;
      if (resumeAt > 1 && resumeAt < durationSeconds - 0.5) {
        video.currentTime = resumeAt;
      }
      sample.current = { media: video.currentTime, wall: performance.now() };
      open.current = { from: video.currentTime, to: video.currentTime };
      if (!completedRef.current && resumeAt >= durationSeconds - 1.5) {
        remember({ from: Math.max(0, durationSeconds - 1), to: durationSeconds });
        sample.current = { media: durationSeconds, wall: performance.now() };
        void sendOpen(false);
      }
    }

    function onRateChange() {
      if (video.playbackRate <= MAX_PLAYBACK_RATE) return;
      video.playbackRate = MAX_PLAYBACK_RATE;
      setNotice("Playback is capped at 2× so the watch time stays honest.");
    }

    function onPause() {
      void sendOpen(false);
    }

    function onEnded() {
      if (open.current && durationSeconds - open.current.to <= 1.5) {
        open.current.to = durationSeconds;
      } else {
        remember({ from: Math.max(0, durationSeconds - 1), to: durationSeconds });
      }
      sample.current = { media: durationSeconds, wall: performance.now() };
      paint(durationSeconds);
      void sendOpen(false).then(() => sendOpen(false));
    }

    function onHide() {
      if (document.visibilityState === "hidden") void sendOpen(true);
    }

    function onUnload() {
      void sendOpen(true);
    }

    flushRef.current = sendOpen;
    const timer = window.setInterval(() => {
      if (video.paused || video.ended) return;
      void sendOpen(false);
    }, 3000);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("ratechange", onRateChange);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    if (video.readyState >= 1) onLoadedMetadata();

    return () => {
      flushRef.current = async () => undefined;
      if (retry !== null) window.clearTimeout(retry);
      window.clearInterval(timer);
      void sendOpen(true);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("ratechange", onRateChange);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
    }
  }, [assignmentId, durationSeconds]);

  async function markComplete() {
    setSaving(true);
    setNotice(null);
    await flushRef.current(false);
    const response = await fetch(`/api/assignments/${assignmentId}/complete`, { method: "POST" });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      progress?: ProgressState;
    } | null;
    setSaving(false);
    if (response.status === 409) {
      setNotice(payload?.error ?? "Watch the video before marking it complete");
      return;
    }
    if (!response.ok) {
      setNotice(payload?.error ?? "Could not mark this assignment complete");
      return;
    }
    setStatus("completed");
    if (payload?.progress) setProgress(payload.progress);
    router.refresh();
  }

  const resumeAt = progress.lastPositionSeconds;
  const showResume = status !== "completed" && resumeAt > 1 && resumeAt < durationSeconds - 1.5;

  return (
    <div className="space-y-4">
      <video
        ref={videoRef}
        controls
        controlsList="noplaybackrate"
        preload="metadata"
        playsInline
        className="max-h-[480px] w-full rounded-md bg-black"
        src={`/api/media/${courseId}`}
      />
      <div>
        <div className="mb-1 flex justify-between text-sm text-neutral-500 dark:text-neutral-300">
          <span>Watched {progress.watchedPercent}%</span>
          <span>
            {formatDuration(progress.watchedSeconds)} / {formatDuration(durationSeconds)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-neutral-200 dark:bg-slate-600">
          <div className="h-full bg-primary" style={{ width: `${progress.watchedPercent}%` }} />
        </div>
        {showResume ? (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-300">
            Resume from {formatDuration(resumeAt)}
          </p>
        ) : null}
      </div>
      {notice ? <p className="text-sm text-neutral-600 dark:text-neutral-300">{notice}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={status === "completed" || !progress.videoCompleted || saving}
          onClick={() => void markComplete()}
        >
          {status === "completed" ? "Completed" : saving ? "Saving…" : "Mark as completed"}
        </Button>
        {status !== "completed" && !progress.videoCompleted ? (
          <p className="text-xs text-neutral-500">Available after the video has been fully watched.</p>
        ) : null}
      </div>
    </div>
  );
}

function seedRanges(progress: { watchedSeconds: number; watchedRanges?: WatchedRange[] }): WatchedRange[] {
  const saved = (progress.watchedRanges ?? []).filter(
    (range) => range.length >= 2 && range[1] > range[0],
  );
  if (saved.length > 0) return mergeRanges(saved);
  if (progress.watchedSeconds > 0) return [[0, progress.watchedSeconds]];
  return [];
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function fit(value: number, durationSeconds: number): number {
  return Math.min(durationSeconds, Math.max(0, round3(Math.min(value, durationSeconds))));
}
