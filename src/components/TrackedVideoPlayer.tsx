"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { watchedPercent } from "@/lib/assignment-view";
import type { WatchedRange } from "@/lib/domain";
import {
  allowedWatchSeconds,
  mergeRanges,
  MAX_PLAYBACK_RATE,
  playbackCredit,
  resumeSeconds,
  sumRanges,
  VIDEO_COMPLETE_RATIO,
} from "@/lib/progress";

type ProgressState = {
  watchedSeconds: number;
  watchedPercent: number;
  lastPositionSeconds: number;
  videoCompleted: boolean;
  watchedRanges?: WatchedRange[];
};

type OpenRange = { from: number; to: number };
type AssignmentStatus = "assigned" | "in_progress" | "completed";
type CourseClip = {
  storedFileName: string;
  originalFileName: string;
  durationSeconds: number;
};

function clipPlacement(clips: CourseClip[], global: number) {
  let offset = 0;
  for (let index = 0; index < clips.length; index += 1) {
    const duration = clips[index]?.durationSeconds ?? 0;
    const end = offset + duration;
    if (global < end - 0.25 || index === clips.length - 1) {
      return { index, offset, local: Math.min(Math.max(global - offset, 0), Math.max(duration, 0)) };
    }
    offset = end;
  }
  return { index: 0, offset: 0, local: 0 };
}

export function TrackedVideoPlayer({
  assignmentId,
  courseId,
  durationSeconds,
  clips,
  initial,
  initialStatus,
}: {
  assignmentId: string;
  courseId: string;
  durationSeconds: number;
  clips?: CourseClip[];
  initial: ProgressState;
  initialStatus: AssignmentStatus;
}) {
  const playlist = clips ?? [];
  const timeline = playlist.length > 1;
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const rangesRef = useRef<WatchedRange[]>(seedRanges(initial));
  const flushRef = useRef<(beacon: boolean) => Promise<void>>(async () => undefined);
  const chooseClipRef = useRef<(index: number) => void>(() => undefined);
  const startNextRef = useRef<(index: number) => void>(() => undefined);
  const clipsRef = useRef(playlist);
  clipsRef.current = playlist;
  const [startAt] = useState(() =>
    resumeSeconds(seedRanges(initial), initial.lastPositionSeconds, durationSeconds),
  );
  const placement = timeline ? clipPlacement(playlist, startAt) : { index: 0, offset: 0, local: startAt };
  const [clipIndex, setClipIndex] = useState(placement.index);
  const [progress, setProgress] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nextPrompt, setNextPrompt] = useState<number | null>(null);

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
      let mediaOffset = placement.offset;
      let clipCursor = placement.index;
      let switching = false;
      let autoplayNext = false;
      let pendingLocal = 0;
      const anchor: { current: { media: number; wall: number } | null } = { current: null };

      function positionOf() {
        return mediaOffset + video.currentTime;
      }
      const open: { current: OpenRange | null } = { current: null };
      const backlog: OpenRange[] = [];
      let inflightRange: OpenRange | null = null;
      let lastAcceptedAt: Date | undefined;
      let resumed = false;
      let inflight = false;
      let retry: number | null = null;
      let stopped = false;
      let hasPlayed = false;
      let suppressSeekNotice = false;
      let seekOrigin = 0;

      function collect(): WatchedRange[] {
        const extra: WatchedRange[] = [];
        for (const range of backlog) {
          if (range.to > range.from) extra.push([range.from, range.to]);
        }
        if (open.current && open.current.to > open.current.from) {
          extra.push([open.current.from, open.current.to]);
        }
        if (inflightRange && inflightRange.to > inflightRange.from) {
          extra.push([inflightRange.from, inflightRange.to]);
        }
        return mergeRanges([...rangesRef.current, ...extra]);
      }

      function paint(position: number) {
        if (stopped) return;
        const ranges = collect();
        const watchedSeconds = sumRanges(ranges);
        setProgress((current) => {
          const seconds = Math.max(current.watchedSeconds, watchedSeconds);
          return {
            ...current,
            watchedSeconds: seconds,
            watchedPercent: watchedPercent(seconds, durationSeconds),
            lastPositionSeconds: position,
            watchedRanges: ranges,
          };
        });
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
        if (retry !== null || stopped) return;
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

      function snapshot() {
        const live = open.current;
        if (!live || live.to <= live.from + 0.2) return;
        const to = Math.min(live.to, durationSeconds);
        remember({ from: live.from, to });
        const playing = !video.paused && !video.ended && !video.seeking;
        open.current = playing ? { from: to, to } : null;
      }

      async function postRange(range: OpenRange, position: number, beacon: boolean): Promise<boolean> {
        const body = {
          from: fit(range.from, durationSeconds),
          to: fit(range.to, durationSeconds),
          position: fit(position, durationSeconds),
        };
        if (!(body.to > body.from)) {
          inflightRange = null;
          return false;
        }
        const url = `/api/assignments/${assignmentId}/progress`;
        const acceptedAt = new Date();
        const previousAccepted = lastAcceptedAt;
        lastAcceptedAt = acceptedAt;
        if (beacon) {
          const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
          if (!navigator.sendBeacon(url, blob)) {
            lastAcceptedAt = previousAccepted;
            inflightRange = null;
            restore(range);
            return false;
          }
          rangesRef.current = mergeRanges([...rangesRef.current, [range.from, range.to]]);
          inflightRange = null;
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
          if (stopped) return response.ok;
          if (!response.ok || !payload?.progress) {
            if (lastAcceptedAt === acceptedAt) lastAcceptedAt = previousAccepted;
            inflightRange = null;
            restore(range);
            setNotice(payload?.error ?? "Progress could not be saved");
            paint(positionOf());
            return false;
          }
          const saved = seedRanges(payload.progress);
          rangesRef.current = mergeRanges([
            ...rangesRef.current,
            ...saved,
            [range.from, range.to],
          ]);
          inflightRange = null;
          const watchedSeconds = sumRanges(collect());
          const ranges = collect();
          setProgress((current) => {
            const seconds = Math.max(current.watchedSeconds, watchedSeconds);
            return {
              ...current,
              ...payload.progress,
              watchedSeconds: seconds,
              watchedPercent: watchedPercent(seconds, durationSeconds),
              videoCompleted: current.videoCompleted || payload.progress?.videoCompleted || false,
              watchedRanges: ranges,
            };
          });
          if (payload.status) setStatus(payload.status);
          setNotice(null);
          return true;
        } finally {
          inflight = false;
        }
      }

      function sendOpen(beacon: boolean): Promise<void> {
        snapshot();
        if (inflight && !beacon) {
          if (backlog.length > 0) scheduleRetry();
          return Promise.resolve();
        }
        const pending = backlog[0];
        if (!pending) return Promise.resolve();
        const sending = clip(pending);
        if (!sending) {
          if (pending.to - pending.from > 0.2) scheduleRetry();
          return Promise.resolve();
        }
        if (sending.to >= pending.to - 0.05) backlog.shift();
        else pending.from = sending.to;
        inflightRange = sending;
        return postRange(sending, sending.to, beacon).then((ok) => {
          if (ok && backlog.length > 0) scheduleRetry();
        });
      }

      function notePlayback(force: boolean) {
        if (stopped || video.seeking || switching) return;
        const media = positionOf();
        const wall = performance.now();
        const previous = anchor.current;
        if (!previous) {
          anchor.current = { media, wall };
          open.current = { from: media, to: media };
          return;
        }
        if (!force && (video.paused || video.ended)) {
          anchor.current = { media, wall };
          return;
        }
        const elapsed = (wall - previous.wall) / 1000;
        const decision = playbackCredit(previous.media, media, elapsed, video.playbackRate);
        if (decision === "still") return;
        if (decision === "seek") {
          snapshot();
          open.current = { from: media, to: media };
          anchor.current = { media, wall };
          if (hasPlayed && media > previous.media + 1) {
            setNotice("Skipping ahead does not count as watched. Playback has to run through the video.");
          }
          return;
        }
        if (!open.current || previous.media > open.current.to + 0.05) {
          open.current = { from: previous.media, to: media };
        } else {
          open.current.to = Math.max(open.current.to, media);
        }
        anchor.current = { media, wall };
        paint(media);
      }

      function armClip(local: number) {
        const media = mediaOffset + local;
        anchor.current = { media, wall: performance.now() };
        open.current = { from: media, to: media };
      }

      function onLoadedMetadata() {
        if (switching) {
          const local = pendingLocal;
          if (Math.abs(video.currentTime - local) >= 0.05) {
            video.currentTime = local;
            return;
          }
          switching = false;
          armClip(video.currentTime);
          if (autoplayNext) {
            autoplayNext = false;
            void video.play().catch(() => undefined);
          }
          return;
        }
        if (resumed) return;
        resumed = true;
        const at = startAt;
        if (at > 1 && at < durationSeconds - 0.5) {
          suppressSeekNotice = true;
          video.currentTime = timeline ? Math.max(0, at - mediaOffset) : at;
          anchor.current = { media: at, wall: performance.now() };
          open.current = { from: at, to: at };
          window.setTimeout(() => {
            suppressSeekNotice = false;
          }, 800);
          return;
        }
        const media = positionOf();
        anchor.current = { media, wall: performance.now() };
        open.current = { from: media, to: media };
      }

      function onPlay() {
        hasPlayed = true;
        setNextPrompt(null);
        const media = positionOf();
        anchor.current = { media, wall: performance.now() };
        if (!open.current || media > open.current.to + 0.05 || media < open.current.from - 0.05) {
          open.current = { from: media, to: media };
        }
      }

      function onSeeking() {
        if (switching) return;
        seekOrigin = anchor.current?.media ?? open.current?.to ?? positionOf();
        snapshot();
      }

      function onSeeked() {
        if (switching) {
          switching = false;
          armClip(video.currentTime);
          if (autoplayNext) {
            autoplayNext = false;
            void video.play().catch(() => undefined);
          }
          return;
        }
        const media = positionOf();
        const origin = seekOrigin;
        anchor.current = { media, wall: performance.now() };
        open.current = { from: media, to: media };
        const notify = !suppressSeekNotice && hasPlayed && media > origin + 1;
        suppressSeekNotice = false;
        if (notify) {
          setNotice("Skipping ahead does not count as watched. Playback has to run through the video.");
        }
      }

      function onRateChange() {
        if (video.playbackRate <= MAX_PLAYBACK_RATE) return;
        video.playbackRate = MAX_PLAYBACK_RATE;
        setNotice("Playback is capped at 2× so the watch time stays honest.");
      }

      function onPause() {
        notePlayback(true);
        void sendOpen(false);
      }

      function bridgeTo(end: number, target: number) {
        if (!(target - end <= 1.5) || !(end > 0)) return;
        if (open.current && end >= open.current.from - 0.05 && end <= open.current.to + 1.5) {
          open.current.to = target;
          return;
        }
        const last = backlog[backlog.length - 1];
        if (last && target - last.to <= 1.5 && end <= last.to + 1.5) {
          last.to = target;
        }
      }

      function onEnded() {
        notePlayback(true);
        const end = open.current?.to ?? anchor.current?.media ?? positionOf();
        const list = clipsRef.current;
        if (timeline && clipCursor < list.length - 1) {
          const boundary = mediaOffset + (list[clipCursor]?.durationSeconds ?? 0);
          bridgeTo(end, boundary);
          paint(Math.min(boundary, durationSeconds));
          setNextPrompt(clipCursor + 1);
          void sendOpen(false).then(() => sendOpen(false));
          return;
        }
        bridgeTo(end, durationSeconds);
        anchor.current = { media: Math.min(positionOf(), durationSeconds), wall: performance.now() };
        paint(Math.min(positionOf(), durationSeconds));
        void sendOpen(false).then(() => sendOpen(false));
      }

      function onHide() {
        if (document.visibilityState === "hidden") void sendOpen(true);
      }

      function onUnload() {
        void sendOpen(true);
      }

      function goToClip(index: number, autoplay: boolean) {
        const list = clipsRef.current;
        if (!timeline || switching || index === clipCursor || index < 0 || index >= list.length) return;
        if (index > playableThroughRef.current && clipDoneRef.current[index] !== true) return;
        snapshot();
        void sendOpen(false);
        let nextOffset = 0;
        for (let cursor = 0; cursor < index; cursor += 1) nextOffset += list[cursor]?.durationSeconds ?? 0;
        switching = true;
        autoplayNext = autoplay;
        pendingLocal = 0;
        mediaOffset = nextOffset;
        clipCursor = index;
        setClipIndex(index);
        setNextPrompt(null);
      }
      chooseClipRef.current = (index: number) => goToClip(index, false);
      startNextRef.current = (index: number) => {
        if (index > playableThroughRef.current) playableThroughRef.current = index;
        goToClip(index, true);
      };
      flushRef.current = (beacon) => sendOpen(beacon);
      const sampleTimer = window.setInterval(() => {
        if (video.paused || video.ended || video.seeking) return;
        notePlayback(false);
      }, 250);
      const sendTimer = window.setInterval(() => {
        if (video.paused || video.ended) return;
        void sendOpen(false);
      }, 3000);

      function onTimeUpdate() {
        notePlayback(false);
      }

      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("play", onPlay);
      video.addEventListener("seeking", onSeeking);
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("pause", onPause);
      video.addEventListener("ended", onEnded);
      video.addEventListener("ratechange", onRateChange);
      document.addEventListener("visibilitychange", onHide);
      window.addEventListener("beforeunload", onUnload);
      if (video.readyState >= 1) onLoadedMetadata();

      return () => {
        stopped = true;
        chooseClipRef.current = () => undefined;
        startNextRef.current = () => undefined;
        flushRef.current = async () => undefined;
        if (retry !== null) window.clearTimeout(retry);
        window.clearInterval(sampleTimer);
        window.clearInterval(sendTimer);
        void sendOpen(true);
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("play", onPlay);
        video.removeEventListener("seeking", onSeeking);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("ratechange", onRateChange);
        document.removeEventListener("visibilitychange", onHide);
        window.removeEventListener("beforeunload", onUnload);
      };
    }
  }, [assignmentId, durationSeconds, placement.index, placement.offset, startAt, timeline]);

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

  const showResume = status !== "completed" && startAt > 1 && startAt < durationSeconds - 1.5;
  const nextClip = nextPrompt === null ? undefined : playlist[nextPrompt];
  const watchedRanges = progress.watchedRanges ?? [];
  const clipDone = playlist.map((_, index) => clipWatched(playlist, watchedRanges, index));
  const playableThrough = clipDone.findIndex((done) => !done);
  const openThrough = playableThrough === -1 ? playlist.length - 1 : playableThrough;
  const playableThroughRef = useRef(openThrough);
  const clipDoneRef = useRef(clipDone);
  playableThroughRef.current = openThrough;
  clipDoneRef.current = clipDone;

  return (
    <div className="space-y-4">
      {timeline ? (
        <ul className="space-y-2">
          {playlist.map((clip, index) => {
            const selected = index === clipIndex;
            const done = clipDone[index] === true;
            const clickable = done || index <= openThrough;
            return (
              <li key={clip.storedFileName}>
                <button
                  type="button"
                  aria-disabled={!clickable}
                  onClick={() => {
                    if (clickable) chooseClipRef.current(index);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm ${
                    clickable ? "" : "opacity-60"
                  } ${
                    selected
                      ? "border-primary text-primary"
                      : "border-neutral-200 text-neutral-700 dark:border-slate-600 dark:text-neutral-200"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {index + 1}. {videoName(clip.originalFileName)}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-neutral-500">
                    {formatDuration(clip.durationSeconds)}
                    <span
                      className={`flex size-4 items-center justify-center rounded-full border ${
                        done ? "border-primary bg-primary text-white" : "border-neutral-400 bg-white dark:bg-transparent"
                      }`}
                      aria-label={done ? "Watched" : "Not watched"}
                    >
                      {done ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <video
        ref={videoRef}
        controls
        controlsList="nodownload noplaybackrate"
        preload="metadata"
        playsInline
        className="max-h-[480px] w-full rounded-md bg-black"
        src={
          timeline
            ? `/api/media/${courseId}?video=${encodeURIComponent(playlist[clipIndex]?.storedFileName ?? "")}`
            : `/api/media/${courseId}`
        }
      />
      {nextClip ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-3 dark:border-slate-600">
          <p className="text-sm text-neutral-700 dark:text-neutral-200">
            This video is finished. Watch {videoName(nextClip.originalFileName)} next?
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setNextPrompt(null)}>
              Not now
            </Button>
            <Button type="button" size="sm" onClick={() => startNextRef.current(nextPrompt ?? 0)}>
              Watch next
            </Button>
          </div>
        </div>
      ) : null}
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
            Resume from {formatDuration(startAt)}
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

function videoName(fileName: string): string {
  return fileName.replace(/\.(mp4|webm)$/i, "");
}

function clipWatched(clips: CourseClip[], ranges: WatchedRange[], index: number): boolean {
  const duration = clips[index]?.durationSeconds ?? 0;
  if (duration <= 0) return false;
  let start = 0;
  for (let cursor = 0; cursor < index; cursor += 1) start += clips[cursor]?.durationSeconds ?? 0;
  let covered = 0;
  const end = start + duration;
  for (const [from, to] of mergeRanges(ranges)) {
    const left = Math.max(from, start);
    const right = Math.min(to, end);
    if (right > left) covered += right - left;
  }
  return covered + 0.001 >= duration * VIDEO_COMPLETE_RATIO;
}
