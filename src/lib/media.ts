import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";

import Busboy from "busboy";

import { courseTextSchema, videoDurationSchema } from "@/lib/validators";

const STORED_FILE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm|pdf)$/;

export class MediaError extends Error {
  readonly status: 400 | 413 | 404 | 500;

  constructor(status: 400 | 413 | 404 | 500, message: string) {
    super(message);
    this.name = "MediaError";
    this.status = status;
  }
}

export type StoredVideo = {
  storedFileName: string;
  originalFileName: string;
  mimeType: "video/mp4" | "video/webm";
  sizeBytes: number;
  durationSeconds: number;
};

export type StoredPdf = {
  storedFileName: string;
  originalFileName: string;
  mimeType: "application/pdf";
  sizeBytes: number;
};

export type StoredUpload = {
  storedFileName: string;
  originalFileName: string;
  mimeType: "video/mp4" | "video/webm";
  sizeBytes: number;
  durationSeconds: number;
  title: string;
  description?: string;
  status?: string;
  /** Stored names the edit form wants to retain, in order. */
  keep: string[];
  /** Playback order. `keep:<stored name>` or `new:<upload index>`. */
  order: string[];
  videos: StoredVideo[];
  /** Stored PDF names the edit form wants to retain, in order. */
  keepPdf: string[];
  /** PDF order. `keep:<stored name>` or `new:<upload index>`. */
  pdfOrder: string[];
  pdfs: StoredPdf[];
};

export type ByteRange =
  | { kind: "full" }
  | { kind: "partial"; start: number; end: number }
  | { kind: "unsatisfiable" };

type Container = "mp4" | "webm" | "pdf";

export function mediaRoot(): string {
  const configured = process.env.MEDIA_DIR?.trim();
  return path.resolve(configured && configured.length > 0 ? configured : path.join(process.cwd(), "media"));
}

/**
 * Stored names are uuid plus extension, never a client path.
 * A directory prefix is stripped with basename before the name is checked,
 * so the resolved file stays inside root.
 */
export function resolveStoredFile(root: string, storedFileName: string): string {
  const leaf = path.basename(storedFileName);
  if (!STORED_FILE_NAME.test(leaf)) {
    throw new MediaError(400, "Invalid file name");
  }
  const base = path.resolve(root);
  const full = path.resolve(base, leaf);
  if (path.dirname(full) !== base) {
    throw new MediaError(400, "Invalid file name");
  }
  return full;
}

export function sniffPdf(header: Buffer): boolean {
  return header.length >= 5 && header.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function sniffContainer(header: Buffer): Container | null {
  if (
    header.length >= 4 &&
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3
  ) {
    return "webm";
  }
  if (header.length < 12 || header.subarray(4, 8).toString("ascii") !== "ftyp") {
    return null;
  }
  if (header.subarray(8, 12).toString("ascii") === "qt  ") return null;
  return "mp4";
}

export function containerForMime(mime: string): Container | null {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "video/mp4" || base === "application/mp4") return "mp4";
  if (base === "video/webm") return "webm";
  return null;
}

/**
 * Single range only. A missing Range header is the whole file.
 * `bytes=start-` and suffix `bytes=-n` follow RFC 9110. Multipart ranges are rejected.
 */
export function parseByteRange(header: string | null, size: number): ByteRange {
  if (!Number.isFinite(size) || size <= 0) return { kind: "unsatisfiable" };
  if (header === null || header.trim() === "") return { kind: "full" };

  const value = header.trim();
  if (value.includes(",")) return { kind: "unsatisfiable" };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match) return { kind: "unsatisfiable" };

  const startRaw = match[1] ?? "";
  const endRaw = match[2] ?? "";
  if (startRaw.length > 15 || endRaw.length > 15) return { kind: "unsatisfiable" };
  if (startRaw === "" && endRaw === "") return { kind: "unsatisfiable" };

  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!Number.isInteger(suffix) || suffix <= 0) return { kind: "unsatisfiable" };
    const start = size - Math.min(suffix, size);
    return { kind: "partial", start, end: size - 1 };
  }

  const start = Number(startRaw);
  if (!Number.isInteger(start) || start < 0 || start >= size) return { kind: "unsatisfiable" };
  const end = endRaw === "" ? size - 1 : Number(endRaw);
  if (!Number.isInteger(end) || end < start) return { kind: "unsatisfiable" };
  return { kind: "partial", start, end: Math.min(end, size - 1) };
}

export async function removeStoredVideo(storedFileName: string, root = mediaRoot()): Promise<void> {
  await discard(resolveStoredFile(root, storedFileName));
}

/**
 * Stream a multipart course upload onto disk. File parts are never accumulated in memory.
 * A maxBytes option is only for tests. Course uploads are not size-capped.
 * requireFile defaults to true. An edit that only removes videos sets it false.
 */
export async function writeVideoUpload(
  request: Request,
  options: { maxBytes?: number; root?: string; requireFile?: boolean } = {},
): Promise<StoredUpload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data") || !request.body) {
    throw new MediaError(400, "Use an mp4 or webm video");
  }

  const root = path.resolve(options.root ?? mediaRoot());
  const maxBytes = options.maxBytes;
  const requireFile = options.requireFile !== false;
  await mkdir(root, { recursive: true });
  const temps: string[] = [];
  const storedNames: string[] = [];

  try {
    const parsed = await parseMultipart(request, contentType, root, temps, maxBytes);
    if (requireFile && parsed.files.length === 0) {
      throw new MediaError(400, "Use an mp4 or webm video");
    }
    const videoFiles = parsed.files.filter((file) => file.container !== "pdf");
    const pdfFiles = parsed.files.filter((file) => file.container === "pdf");
    if (parsed.durations.length !== videoFiles.length) {
      throw new MediaError(400, "Each video needs a length");
    }

    const description = parsed.fields.get("description");
    const details = courseTextSchema.safeParse({
      title: parsed.fields.get("title") ?? "",
      description: description && description.trim().length > 0 ? description : undefined,
    });
    if (!details.success) {
      throw new MediaError(400, details.error.issues[0]?.message ?? "Check the form");
    }

    const videos: StoredVideo[] = [];
    for (let index = 0; index < videoFiles.length; index += 1) {
      const file = videoFiles[index];
      if (!file || file.container === "pdf") continue;
      if (maxBytes !== undefined && (file.truncated || file.sizeBytes > maxBytes)) {
        throw new MediaError(413, `That video is larger than ${formatUploadLimit(maxBytes)}`);
      }
      if (file.sizeBytes < 12) {
        throw new MediaError(400, "Use an mp4 or webm video");
      }
      const sniffed = sniffContainer(await readHeader(file.tempPath));
      if (!sniffed || sniffed !== file.container) {
        throw new MediaError(400, "Use an mp4 or webm video");
      }
      const duration = videoDurationSchema.safeParse(Number(parsed.durations[index]));
      if (!duration.success) {
        throw new MediaError(400, duration.error.issues[0]?.message ?? "Check the form");
      }
      const storedFileName = `${randomUUID()}.${sniffed}`;
      await rename(file.tempPath, resolveStoredFile(root, storedFileName));
      const tempIndex = temps.indexOf(file.tempPath);
      if (tempIndex >= 0) temps.splice(tempIndex, 1);
      storedNames.push(storedFileName);
      videos.push({
        storedFileName,
        originalFileName: displayFileName(file.filename, sniffed),
        mimeType: sniffed === "mp4" ? "video/mp4" : "video/webm",
        sizeBytes: file.sizeBytes,
        durationSeconds: duration.data,
      });
    }

    const pdfs: StoredPdf[] = [];
    for (const file of pdfFiles) {
      if (maxBytes !== undefined && (file.truncated || file.sizeBytes > maxBytes)) {
        throw new MediaError(413, `That PDF is larger than ${formatUploadLimit(maxBytes)}`);
      }
      if (file.sizeBytes < 5 || !sniffPdf(await readHeader(file.tempPath))) {
        throw new MediaError(400, "Use a PDF file");
      }
      const storedFileName = `${randomUUID()}.pdf`;
      await rename(file.tempPath, resolveStoredFile(root, storedFileName));
      const tempIndex = temps.indexOf(file.tempPath);
      if (tempIndex >= 0) temps.splice(tempIndex, 1);
      storedNames.push(storedFileName);
      pdfs.push({
        storedFileName,
        originalFileName: displayFileName(file.filename, "pdf"),
        mimeType: "application/pdf",
        sizeBytes: file.sizeBytes,
      });
    }

    const first = videos[0];
    return {
      storedFileName: first?.storedFileName ?? "",
      originalFileName: first?.originalFileName ?? "",
      mimeType: first?.mimeType ?? "video/mp4",
      sizeBytes: first?.sizeBytes ?? 0,
      durationSeconds: first?.durationSeconds ?? 0,
      title: details.data.title,
      description: details.data.description,
      status: parsed.fields.get("status"),
      keep: parsed.keep,
      order: parsed.order,
      videos,
      keepPdf: parsed.keepPdf,
      pdfOrder: parsed.pdfOrder,
      pdfs,
    };
  } catch (error) {
    await Promise.all(storedNames.map((name) => removeStoredVideo(name, root).catch(() => undefined)));
    await Promise.all(temps.map((tempPath) => discard(tempPath).catch(() => undefined)));
    throw error;
  }
}

export async function fileRangeResponse(
  request: Request,
  filePath: string,
  mimeType: string,
  downloadName: string,
): Promise<Response> {
  const handle = await open(filePath, "r");
  let size = 0;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size <= 0) {
      throw new MediaError(404, "Not found");
    }
    size = info.size;
  } finally {
    await handle.close();
  }

  const range = parseByteRange(request.headers.get("range"), size);
  const headers = new Headers();
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Type", mimeType === "application/pdf" ? "application/pdf" : mimeType === "video/webm" ? "video/webm" : "video/mp4");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", contentDisposition(downloadName));

  if (range.kind === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const start = range.kind === "partial" ? range.start : 0;
  const end = range.kind === "partial" ? range.end : size - 1;
  const status = range.kind === "partial" ? 206 : 200;
  headers.set("Content-Length", String(end - start + 1));
  if (status === 206) {
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  if (request.method === "HEAD") {
    return new Response(null, { status, headers });
  }

  const nodeStream = createReadStream(filePath, { start, end });
  const abort = () => nodeStream.destroy();
  request.signal.addEventListener("abort", abort, { once: true });
  nodeStream.on("close", () => request.signal.removeEventListener("abort", abort));
  nodeStream.on("error", () => nodeStream.destroy());

  return new Response(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, { status, headers });
}

type ParsedFile = {
  tempPath: string;
  filename: string | undefined;
  container: Container;
  sizeBytes: number;
  truncated: boolean;
};

type ParsedUpload = {
  fields: Map<string, string>;
  durations: string[];
  keep: string[];
  order: string[];
  keepPdf: string[];
  pdfOrder: string[];
  files: ParsedFile[];
};

function parseMultipart(
  request: Request,
  contentType: string,
  root: string,
  temps: string[],
  maxBytes?: number,
): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    let busboy: ReturnType<typeof Busboy>;
    try {
      busboy = Busboy({
        headers: { "content-type": contentType },
        defParamCharset: "utf8",
        limits: {
          ...(maxBytes !== undefined ? { fileSize: maxBytes + 1 } : {}),
          fieldSize: 16 * 1024,
        },
      });
    } catch {
      reject(new MediaError(400, "Upload could not be read"));
      return;
    }

    const fields = new Map<string, string>();
    const durations: string[] = [];
    const keep: string[] = [];
    const order: string[] = [];
    const keepPdf: string[] = [];
    const pdfOrder: string[] = [];
    const files: ParsedFile[] = [];
    const fileTasks: Promise<void>[] = [];
    let settled = false;
    let badType = false;
    let badPdf = false;
    let extraFile = false;
    let fieldError = false;

    const source = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream<Uint8Array>);

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      source.destroy();
      if (!busboy.destroyed) busboy.destroy();
      reject(error instanceof MediaError ? error : new MediaError(400, "Upload could not be read"));
    };

    busboy.on("field", (name, value, info) => {
      if (info.valueTruncated || info.nameTruncated) {
        fieldError = true;
        return;
      }
      if (name === "durationSeconds") {
        durations.push(value);
        return;
      }
      if (name === "keep") {
        keep.push(value);
        return;
      }
      if (name === "order") {
        order.push(value);
        return;
      }
      if (name === "keepPdf") {
        keepPdf.push(value);
        return;
      }
      if (name === "pdfOrder") {
        pdfOrder.push(value);
        return;
      }
      if (name === "title" || name === "description" || name === "status") {
        fields.set(name, value);
      }
    });

    busboy.on("file", (name, stream, info) => {
      const declared = name === "video" ? containerForMime(info.mimeType) : name === "pdf" ? declaredPdf(info) : null;
      if (name !== "video" && name !== "pdf") {
        extraFile = true;
        stream.resume();
        return;
      }
      if (!declared) {
        if (name === "pdf") badPdf = true;
        else badType = true;
        stream.resume();
        return;
      }
      const tempPath = path.join(root, `.upload-${randomUUID()}.part`);
      temps.push(tempPath);
      const entry: ParsedFile = {
        tempPath,
        filename: info.filename,
        container: declared,
        sizeBytes: 0,
        truncated: false,
      };
      files.push(entry);
      const counter = new PassThrough();
      counter.on("data", (chunk: Buffer) => {
        entry.sizeBytes += chunk.length;
      });
      fileTasks.push(
        pipeline(stream, counter, createWriteStream(tempPath))
          .then(() => {
            entry.truncated = Boolean(stream.truncated);
          })
          .catch((error: unknown) => {
            fail(error);
          }),
      );
    });

    busboy.on("filesLimit", () => {
      extraFile = true;
    });
    busboy.on("fieldsLimit", () => {
      fieldError = true;
    });
    busboy.on("partsLimit", () => {
      fieldError = true;
    });
    busboy.on("error", (error) => fail(error));
    source.on("error", (error) => fail(error));
    request.signal.addEventListener("abort", () => fail(new MediaError(400, "Upload cancelled")), { once: true });

    busboy.on("close", () => {
      void Promise.all(fileTasks)
        .then(() => {
          if (settled) return;
          if (extraFile) {
            fail(new MediaError(400, "Use an mp4 or webm video"));
            return;
          }
          if (badPdf) {
            fail(new MediaError(400, "Use a PDF file"));
            return;
          }
          if (badType) {
            fail(new MediaError(400, "Use an mp4 or webm video"));
            return;
          }
          if (fieldError) {
            fail(new MediaError(400, "Check the form"));
            return;
          }
          settled = true;
          resolve({ fields, durations, keep, order, keepPdf, pdfOrder, files });
        })
        .catch((error: unknown) => fail(error));
    });

    source.pipe(busboy);
  });
}

async function readHeader(filePath: string): Promise<Buffer> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(32);
    const { bytesRead } = await handle.read(buffer, 0, 32, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function formatUploadLimit(maxBytes: number): string {
  const mb = 1024 * 1024;
  if (maxBytes % mb === 0) return `${maxBytes / mb} MB`;
  if (maxBytes > mb) return `${(maxBytes / mb).toFixed(1)} MB`;
  return `${maxBytes} bytes`;
}

function declaredPdf(info: { mimeType: string; filename?: string }): "pdf" | null {
  const base = info.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const filename = (info.filename ?? "").toLowerCase();
  if (base === "application/pdf" || filename.endsWith(".pdf")) return "pdf";
  return null;
}

function displayFileName(filename: string | undefined, container: Container): string {
  const leaf = (filename ?? "").split(/[/\\]/).pop() ?? "";
  const cleaned = leaf.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 180);
  if (!cleaned || cleaned === "." || cleaned === "..") return container === "pdf" ? "document.pdf" : `video.${container}`;
  return cleaned;
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "").trim().slice(0, 180);
  return `inline; filename="${ascii || "video"}"`;
}

async function discard(filePath: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await unlink(filePath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;
      if ((code === "EBUSY" || code === "EPERM") && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 40));
        continue;
      }
      throw error;
    }
  }
}
