"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CourseStatus } from "@/lib/domain";
import { formatDuration } from "@/lib/format";

import type { CourseEditState } from "./actions";

const selectClass =
  "border-input dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const fieldClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-24 w-full rounded-md border bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const emptyState: CourseEditState = { error: null, saved: false };

export function CourseEditForm({
  courseId,
  title,
  description,
  status,
  fileName,
  action,
}: {
  courseId: string;
  title: string;
  description: string;
  status: CourseStatus;
  fileName: string;
  action: (previous: CourseEditState, formData: FormData) => Promise<CourseEditState>;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, formAction, pending] = useActionState(action, emptyState);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [replaced, setReplaced] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!file || !video) return;

    const url = URL.createObjectURL(file);
    const onReady = () => {
      const value = video.duration;
      if (!Number.isFinite(value) || value <= 0) {
        setDuration(null);
        setUploadError("Could not read the video length. Use an mp4 or webm file.");
        return;
      }
      setDuration(value);
      setUploadError(null);
    };
    const onFail = () => {
      setDuration(null);
      setUploadError("Could not read the video length. Use an mp4 or webm file.");
    };

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("error", onFail);
    video.src = url;
    video.load();

    return () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("error", onFail);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setDuration(null);
    setUploadError(null);
    setReplaced(false);
    setProgress(null);
    if (!next) {
      setFile(null);
      return;
    }

    const name = next.name.toLowerCase();
    const extensionOk = name.endsWith(".mp4") || name.endsWith(".webm");
    const typeOk = next.type === "" || next.type === "video/mp4" || next.type === "video/webm";
    if (!extensionOk || !typeOk) {
      setFile(null);
      event.target.value = "";
      setUploadError("Use an mp4 or webm video");
      return;
    }
    setFile(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!file) return;
    event.preventDefault();
    if (duration === null) {
      setUploadError("Wait until the video length is read.");
      return;
    }

    const body = new FormData(event.currentTarget);
    body.set("durationSeconds", String(duration));
    body.set("video", file);
    setUploadError(null);
    setProgress(0);
    void putCourse(`/api/admin/courses/${courseId}`, body, setProgress)
      .then(() => {
        setProgress(null);
        setFile(null);
        setReplaced(true);
        router.refresh();
      })
      .catch((uploadError: unknown) => {
        setProgress(null);
        setUploadError(uploadError instanceof Error ? uploadError.message : "Upload failed");
      });
  }

  const uploading = progress !== null;
  const error = uploadError ?? state.error;

  return (
    <form action={formAction} onSubmit={onSubmit} className="relative max-w-3xl space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Title
          <Input name="title" required maxLength={200} defaultValue={title} disabled={uploading} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Status
          <select name="status" defaultValue={status} className={selectClass} disabled={uploading}>
            <option value="active">Active</option>
            <option value="archived">Inactive</option>
          </select>
        </label>
      </div>
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
        Video
        <Input
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          onChange={onFile}
          disabled={uploading}
        />
      </label>
      <video ref={videoRef} preload="metadata" className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden />
      <p className="text-sm text-neutral-500 dark:text-neutral-300">
        Current file: {fileName}. Choose a new mp4 or webm file to replace it.
        {duration !== null ? ` New length ${formatDuration(duration)}.` : ""}
      </p>
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
      <Button type="submit" disabled={uploading || pending || (file !== null && duration === null)}>
        {uploading || pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

function putCourse(url: string, body: FormData, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let payload: { error?: unknown } = {};
      try {
        payload = JSON.parse(xhr.responseText) as { error?: unknown };
      } catch {
        reject(new Error("Upload failed"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(typeof payload.error === "string" ? payload.error : "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(body);
  });
}
