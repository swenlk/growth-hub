"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PdfField, type PdfStrip } from "./pdf-field";
import { VideoField, type VideoStrip } from "./video-field";

const fieldClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-24 w-full rounded-md border bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

export function CourseCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [strips, setStrips] = useState<VideoStrip[]>([]);
  const [pdfs, setPdfs] = useState<PdfStrip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pending = strips.flatMap((strip) => (strip.kind === "pending" ? [strip.video] : []));
    if (pending.length === 0) {
      setError("Add at least one video");
      return;
    }
    if (pending.some((item) => item.error)) {
      setError("Remove the video whose length could not be read.");
      return;
    }
    if (pending.some((item) => item.duration === null)) {
      setError("Wait until each video length is read.");
      return;
    }

    const body = new FormData();
    body.set("title", title);
    body.set("description", description);
    for (const item of pending) {
      body.append("durationSeconds", String(item.duration));
      body.append("video", item.file);
    }
    for (const strip of pdfs) {
      if (strip.kind === "pending") body.append("pdf", strip.pdf.file);
    }

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
  const waiting = strips.some((strip) => strip.kind === "pending" && strip.video.duration === null && !strip.video.error);

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
        <div className="grid content-start gap-6">
          <VideoField strips={strips} setStrips={setStrips} disabled={uploading} onPickError={setError} />
          <PdfField strips={pdfs} setStrips={setPdfs} disabled={uploading} onPickError={setError} />
        </div>
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
      <Button type="submit" disabled={uploading || strips.length === 0 || waiting}>
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
