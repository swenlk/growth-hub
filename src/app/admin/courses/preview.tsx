"use client";

import { useState } from "react";

import { formatBytes, formatDuration } from "@/lib/format";

export function CourseVideoPreview({
  courseId,
  videos,
}: {
  courseId: string;
  videos: {
    storedFileName: string;
    originalFileName: string;
    durationSeconds: number;
    sizeBytes: number;
  }[];
}) {
  const [index, setIndex] = useState(0);
  const active = videos[index] ?? videos[0];
  if (!active) return null;

  return (
    <div className="space-y-4">
      {videos.length > 1 ? (
        <ul className="space-y-2">
          {videos.map((video, videoIndex) => {
            const selected = videoIndex === index;
            return (
              <li key={video.storedFileName}>
                <button
                  type="button"
                  onClick={() => setIndex(videoIndex)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm ${
                    selected
                      ? "border-primary text-primary"
                      : "border-neutral-200 text-neutral-700 dark:border-slate-600 dark:text-neutral-200"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {videoIndex + 1}. {video.originalFileName}
                  </span>
                  <span className="shrink-0 text-neutral-500 dark:text-neutral-300">
                    {formatDuration(video.durationSeconds)} · {formatBytes(video.sizeBytes)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <video
        key={active.storedFileName}
        controls
        controlsList="nodownload"
        preload="metadata"
        playsInline
        className="max-h-[480px] w-full rounded-md bg-black"
        src={`/api/media/${courseId}?video=${encodeURIComponent(active.storedFileName)}`}
      />
    </div>
  );
}
