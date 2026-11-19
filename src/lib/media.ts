import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";

import Busboy from "busboy";

import { courseDetailsSchema } from "@/lib/validators";

const STORED_FILE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$/;

const DEFAULT_MAX_BYTES = 500 * 1024 * 1024;

export class MediaError extends Error {
  readonly status: 400 | 413 | 404 | 500;

  constructor(status: 400 | 413 | 404 | 500, message: string) {
    super(message);
    this.name = "MediaError";
    this.status = status;
  }
}

export type StoredUpload = {
  storedFileName: string;
  originalFileName: string;
  mimeType: "video/mp4" | "video/webm";
  sizeBytes: number;
  durationSeconds: number;
  title: string;
  description?: string;
};

export type ByteRange =
  | { kind: "full" }
  | { kind: "partial"; start: number; end: number }
  | { kind: "unsatisfiable" };

type Container = "mp4" | "webm";

export function mediaRoot(): string {
  const configured = process.env.MEDIA_DIR?.trim();
  return path.resolve(configured && configured.length > 0 ? configured : path.join(process.cwd(), "media"));
}

export function maxUploadBytes(): number {
  const raw = process.env.MAX_UPLOAD_MB?.trim();
  if (!raw) return DEFAULT_MAX_BYTES;
  const mb = Number(raw);
  if (!Number.isFinite(mb) || mb <= 0 || mb > 4096) {
    throw new Error("MAX_UPLOAD_MB must be a number from 1 to 4096");
  }
  return Math.floor(mb * 1024 * 1024);
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
 * Stream a multipart course upload onto disk. The file part is never accumulated in memory.
 * Busboy's limit is one byte above the max so a file that is exactly the max is kept.
 */
export async function writeVideoUpload(
  request: Request,
  options: { maxBytes?: number; root?: string } = {},
): Promise<StoredUpload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data") || !request.body) {
    throw new MediaError(400, "Use an mp4 or webm video");
  }

  const root = path.resolve(options.root ?? mediaRoot());
  const maxBytes = options.maxBytes ?? maxUploadBytes();
  await mkdir(root, { recursive: true });
  const tempPath = path.join(root, `.upload-${randomUUID()}.part`);

  try {
    const parsed = await parseMultipart(request, contentType, tempPath, maxBytes);
    if (parsed.truncated || parsed.sizeBytes > maxBytes) {
      throw new MediaError(413, `That video is larger than ${formatUploadLimit(maxBytes)}`);
    }
    if (parsed.sizeBytes < 12) {
      throw new MediaError(400, "Use an mp4 or webm video");
    }

    const sniffed = sniffContainer(await readHeader(tempPath));
    if (!sniffed || sniffed !== parsed.container) {
      throw new MediaError(400, "Use an mp4 or webm video");
    }

    const description = parsed.fields.get("description");
    const details = courseDetailsSchema.safeParse({
      title: parsed.fields.get("title") ?? "",
      description: description && description.trim().length > 0 ? description : undefined,
      durationSeconds: Number(parsed.fields.get("durationSeconds")),
    });
    if (!details.success) {
      throw new MediaError(400, details.error.issues[0]?.message ?? "Check the form");
    }

    const storedFileName = `${randomUUID()}.${sniffed}`;
    const finalPath = resolveStoredFile(root, storedFileName);
    await rename(tempPath, finalPath);

    return {
      storedFileName,
      originalFileName: displayFileName(parsed.filename, sniffed),
      mimeType: sniffed === "mp4" ? "video/mp4" : "video/webm",
      sizeBytes: parsed.sizeBytes,
      durationSeconds: details.data.durationSeconds,
      title: details.data.title,
      description: details.data.description,
    };
  } catch (error) {
    await discard(tempPath);
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
  headers.set("Content-Type", mimeType === "video/webm" ? "video/webm" : "video/mp4");
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

type ParsedUpload = {
  fields: Map<string, string>;
  filename: string | undefined;
  container: Container;
  sizeBytes: number;
  truncated: boolean;
};

function parseMultipart(
  request: Request,
  contentType: string,
  tempPath: string,
  maxBytes: number,
): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    let busboy: ReturnType<typeof Busboy>;
    try {
      busboy = Busboy({
        headers: { "content-type": contentType },
        defParamCharset: "utf8",
        limits: {
          files: 1,
          fileSize: maxBytes + 1,
          fields: 8,
          fieldSize: 16 * 1024,
          parts: 12,
        },
      });
    } catch {
      reject(new MediaError(400, "Upload could not be read"));
      return;
    }

    const fields = new Map<string, string>();
    let settled = false;
    let fileSeen = false;
    let badType = false;
    let extraFile = false;
    let fieldError = false;
    let filename: string | undefined;
    let container: Container | null = null;
    let sizeBytes = 0;
    let truncated = false;
    let fileDone: Promise<void> = Promise.resolve();

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
      if (name === "title" || name === "description" || name === "durationSeconds") {
        fields.set(name, value);
      }
    });

    busboy.on("file", (name, stream, info) => {
      if (fileSeen || name !== "video") {
        extraFile = true;
        stream.resume();
        return;
      }
      fileSeen = true;
      const declared = containerForMime(info.mimeType);
      if (!declared) {
        badType = true;
        stream.resume();
        return;
      }
      container = declared;
      filename = info.filename;
      const counter = new PassThrough();
      counter.on("data", (chunk: Buffer) => {
        sizeBytes += chunk.length;
      });
      fileDone = pipeline(stream, counter, createWriteStream(tempPath))
        .then(() => {
          truncated = Boolean(stream.truncated);
        })
        .catch((error: unknown) => {
          fail(error);
        });
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
      void fileDone
        .then(() => {
          if (settled) return;
          if (extraFile) {
            fail(new MediaError(400, "Send one video file"));
            return;
          }
          const chosen = container;
          if (!fileSeen || badType || !chosen) {
            fail(new MediaError(400, "Use an mp4 or webm video"));
            return;
          }
          if (fieldError) {
            fail(new MediaError(400, "Check the form"));
            return;
          }
          settled = true;
          resolve({ fields, filename, container: chosen, sizeBytes, truncated });
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

function displayFileName(filename: string | undefined, container: Container): string {
  const leaf = (filename ?? "").split(/[/\\]/).pop() ?? "";
  const cleaned = leaf.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 180);
  if (!cleaned || cleaned === "." || cleaned === "..") return `video.${container}`;
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
