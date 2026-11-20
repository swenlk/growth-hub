"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/format";

const fieldClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-24 w-full rounded-md border bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

export function CourseCreateForm() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!file || !video) return;

    const url = URL.createObjectURL(file);
    const onReady = () => {
      const value = video.duration;
      if (!Number.isFinite(value) || value <= 0) {
        setDuration(null);
        setError("Could not read the video length. Use an mp4 or webm file.");
        return;
      }
      setDuration(value);
      setError(null);
    };
    const onFail = () => {
      setDuration(null);
      setError("Could not read the video length. Use an mp4 or webm file.");
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
    setError(null);
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
      setError("Use an mp4 or webm video");
      return;
    }
    setFile(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || duration === null) {
      setError("Choose a video and wait until its length is read.");
      return;
    }

    const body = new FormData();
    body.set("title", title);
    body.set("description", description);
    body.set("durationSeconds", String(duration));
    body.set("video", file);

    setError(null);
    setProgress(0);
    void postCourse(body, setProgress)
      .then(() => {
        router.push("/admin/courses");
        router.refresh();
      })
      .catch((uploadError: unknown) => {
        setProgress(null);
        setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
      });
  }

  const uploading = progress !== null;

  return (
    <form onSubmit={onSubmit} className="relative space-y-4">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Title
            <Input
              name="title"
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={uploading}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Description
            <textarea
              name="description"
              maxLength={4000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={uploading}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="grid content-start gap-2">
          <label className="grid gap-2 text-sm font-medium">
            Video
            <Input
              name="video"
              type="file"
              accept="video/mp4,video/webm,.mp4,.webm"
              required
              onChange={onFile}
              disabled={uploading}
            />
          </label>
          <p className="text-sm font-normal text-neutral-500 dark:text-neutral-300">
            mp4 or webm. The length is read in the browser before upload.
            {duration !== null ? ` Length ${formatDuration(duration)}.` : ""}
          </p>
        </div>
      </div>
      <video ref={videoRef} preload="metadata" className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden />
      {uploading ? (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded bg-neutral-200 dark:bg-slate-600">
            <div className="h-full bg-primary" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
          <p className="text-sm text-neutral-500">Uploading {Math.round((progress ?? 0) * 100)}%</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={uploading || duration === null}>
        {uploading ? "Uploading…" : "Create course"}
      </Button>
    </form>
  );
}

function postCourse(body: FormData, onProgress: (ratio: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/courses");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let payload: { id?: unknown; error?: unknown } = {};
      try {
        payload = JSON.parse(xhr.responseText) as { id?: unknown; error?: unknown };
      } catch {
        reject(new Error("Upload failed"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof payload.id === "string") {
        resolve(payload.id);
        return;
      }
      reject(new Error(typeof payload.error === "string" ? payload.error : "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(body);
  });
}
