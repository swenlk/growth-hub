"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { CourseStatus } from "@/lib/domain";

import type { CourseEditState } from "./actions";
import { VideoField, type SavedVideo, type VideoStrip } from "./video-field";

const fieldClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-24 w-full rounded-md border bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const emptyState: CourseEditState = { error: null, saved: false };

export function CourseEditForm({
  courseId,
  title,
  description,
  status,
  videos,
  action,
}: {
  courseId: string;
  title: string;
  description: string;
  status: CourseStatus;
  videos: SavedVideo[];
  action: (previous: CourseEditState, formData: FormData) => Promise<CourseEditState>;
}) {
  const router = useRouter();
  const [state, formAction, pendingSave] = useActionState(action, emptyState);
  const [strips, setStrips] = useState<VideoStrip[]>(() => videos.map((video) => ({ kind: "saved", video })));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [replaced, setReplaced] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  function videosChanged() {
    const saved = strips.flatMap((strip) => (strip.kind === "saved" ? [strip.video] : []));
    if (strips.some((strip) => strip.kind === "pending")) return true;
    if (saved.length !== videos.length) return true;
    return saved.some((video, index) => video.storedFileName !== videos[index]?.storedFileName);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!videosChanged()) return;
    event.preventDefault();
    const pending = strips.flatMap((strip) => (strip.kind === "pending" ? [strip.video] : []));
    if (strips.length === 0) {
      setUploadError("Add at least one video");
      return;
    }
    if (pending.some((item) => item.error)) {
      setUploadError("Remove the video whose length could not be read.");
      return;
    }
    if (pending.some((item) => item.duration === null)) {
      setUploadError("Wait until each video length is read.");
      return;
    }

    const body = new FormData(event.currentTarget);
    let newIndex = 0;
    for (const strip of strips) {
      if (strip.kind === "saved") {
        body.append("keep", strip.video.storedFileName);
        body.append("order", `keep:${strip.video.storedFileName}`);
      } else {
        body.append("durationSeconds", String(strip.video.duration));
        body.append("video", strip.video.file);
        body.append("order", `new:${newIndex}`);
        newIndex += 1;
      }
    }
    setUploadError(null);
    setReplaced(false);
    setProgress(0);
    void putCourse(`/api/admin/courses/${courseId}`, body, setProgress)
      .then((saved) => {
        setProgress(null);
        if (saved.length > 0) setStrips(saved.map((video) => ({ kind: "saved", video })));
        setReplaced(true);
        router.refresh();
      })
      .catch((failure: unknown) => {
        setProgress(null);
        setUploadError(failure instanceof Error ? failure.message : "Upload failed");
      });
  }

  const uploading = progress !== null;
  const waiting = strips.some((strip) => strip.kind === "pending" && strip.video.duration === null && !strip.video.error);
  const error = uploadError ?? state.error;

  return (
    <form action={formAction} onSubmit={onSubmit} className="relative space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Title
            <Input name="title" required maxLength={200} defaultValue={title} disabled={uploading} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Description
            <textarea
              name="description"
              maxLength={4000}
              defaultValue={description}
              className={fieldClass}
              disabled={uploading}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Status
            <SearchableSelect
              name="status"
              ariaLabel="Status"
              defaultValue={status}
              disabled={uploading}
              options={[
                { value: "active", label: "Active" },
                { value: "archived", label: "Inactive" },
              ]}
            />
          </label>
        </div>
        <VideoField strips={strips} setStrips={setStrips} disabled={uploading} onPickError={setUploadError} />
      </div>
      {uploading ? (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded bg-neutral-200 dark:bg-slate-600">
            <div className="h-full bg-primary" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
          <p className="text-sm text-neutral-500">Uploading {Math.round((progress ?? 0) * 100)}%</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {state.saved || replaced ? <p className="text-sm text-neutral-600 dark:text-neutral-300">Saved.</p> : null}
      <Button type="submit" disabled={uploading || pendingSave || waiting || strips.length === 0}>
        {uploading || pendingSave ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

function putCourse(url: string, body: FormData, onProgress: (ratio: number) => void): Promise<SavedVideo[]> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let payload: { error?: unknown; videos?: unknown } = {};
      try {
        payload = JSON.parse(xhr.responseText) as { error?: unknown; videos?: unknown };
      } catch {
        reject(new Error("Upload failed"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(readSavedVideos(payload.videos));
        return;
      }
      reject(new Error(typeof payload.error === "string" ? payload.error : "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(body);
  });
}

function readSavedVideos(value: unknown): SavedVideo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const video = item as Partial<SavedVideo>;
    if (
      typeof video.storedFileName !== "string" ||
      typeof video.originalFileName !== "string" ||
      typeof video.durationSeconds !== "number" ||
      typeof video.sizeBytes !== "number"
    ) {
      return [];
    }
    return [
      {
        storedFileName: video.storedFileName,
        originalFileName: video.originalFileName,
        durationSeconds: video.durationSeconds,
        sizeBytes: video.sizeBytes,
      },
    ];
  });
}
