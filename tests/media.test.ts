import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  MediaError,
  fileRangeResponse,
  parseByteRange,
  resolveStoredFile,
  sniffContainer,
  writeVideoUpload,
} from "../src/lib/media";

const id = "123e4567-e89b-12d3-a456-426614174000";

function mp4(bytes = 64, brand = "isom"): Buffer {
  const buffer = Buffer.alloc(bytes);
  buffer.writeUInt32BE(24, 0);
  buffer.write("ftyp", 4, "ascii");
  buffer.write(brand, 8, "ascii");
  return buffer;
}

function webm(bytes = 64): Buffer {
  const buffer = Buffer.alloc(bytes);
  buffer[0] = 0x1a;
  buffer[1] = 0x45;
  buffer[2] = 0xdf;
  buffer[3] = 0xa3;
  return buffer;
}

function multipart(
  fields: Record<string, string>,
  file: { name: string; type: string; data: Buffer },
  extraFile?: { name: string; type: string; data: Buffer; durationSeconds?: string },
) {
  const boundary = "----mediatest";
  const chunks: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  const pushFile = (part: { name: string; type: string; data: Buffer; durationSeconds?: string }) => {
    if (part.durationSeconds) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="durationSeconds"\r\n\r\n${part.durationSeconds}\r\n`,
        ),
      );
    }
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="${part.name}"\r\nContent-Type: ${part.type}\r\n\r\n`,
      ),
    );
    chunks.push(part.data);
    chunks.push(Buffer.from("\r\n"));
  };
  pushFile(file);
  if (extraFile) pushFile(extraFile);
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return new Request("http://localhost/api/admin/courses", {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(chunks),
  });
}

function fieldsOnly(fields: Record<string, string>, keep: string[]) {
  const boundary = "----mediatest";
  const chunks: Buffer[] = [];
  const pushField = (key: string, value: string) => {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  };
  for (const [key, value] of Object.entries(fields)) pushField(key, value);
  for (const name of keep) pushField("keep", name);
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return new Request("http://localhost/api/admin/courses", {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(chunks),
  });
}

async function main() {
  assert.equal(parseByteRange(null, 100).kind, "full");
  assert.deepEqual(parseByteRange("bytes=0-", 100), { kind: "partial", start: 0, end: 99 });
  assert.deepEqual(parseByteRange("bytes=0-9", 100), { kind: "partial", start: 0, end: 9 });
  assert.deepEqual(parseByteRange("bytes=90-1000", 100), { kind: "partial", start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-10", 100), { kind: "partial", start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=0-0", 100), { kind: "partial", start: 0, end: 0 });
  assert.equal(parseByteRange("bytes=100-", 100).kind, "unsatisfiable");
  assert.equal(parseByteRange("bytes=50-40", 100).kind, "unsatisfiable");
  assert.equal(parseByteRange("bytes=0-1,2-3", 100).kind, "unsatisfiable");
  assert.equal(parseByteRange("bytes=0-0", 0).kind, "unsatisfiable");

  assert.equal(sniffContainer(mp4()), "mp4");
  assert.equal(sniffContainer(webm()), "webm");
  assert.equal(sniffContainer(mp4(64, "qt  ")), null);
  assert.equal(sniffContainer(Buffer.from("not a video, really")), null);

  const root = await mkdtemp(path.join(tmpdir(), "training-media-"));
  try {
    const stored = resolveStoredFile(root, `${id}.mp4`);
    assert.equal(path.basename(stored), `${id}.mp4`);
    assert.equal(path.dirname(stored), path.resolve(root));
    const nested = resolveStoredFile(root, path.join("..", "..", `${id}.mp4`));
    assert.equal(path.basename(nested), `${id}.mp4`);
    assert.equal(path.dirname(nested), path.resolve(root));
    for (const bad of ["../secret.mp4", "..\\secret.mp4", `${id}.exe`, "not-a-uuid.mp4", `${id}.mp4/../../x`]) {
      assert.throws(() => resolveStoredFile(root, bad), MediaError);
    }

    const clip = mp4(48);
    const uploaded = await writeVideoUpload(
      multipart(
        { title: " Safety ", description: "  Wear gloves. ", durationSeconds: "95.2" },
        { name: "..\\lesson 1.mp4", type: "video/mp4", data: clip },
      ),
      { root, maxBytes: clip.length },
    );
    assert.match(uploaded.storedFileName, /^[0-9a-f-]{36}\.mp4$/);
    assert.equal(uploaded.originalFileName, "lesson 1.mp4");
    assert.equal(uploaded.title, "Safety");
    assert.equal(uploaded.description, "Wear gloves.");
    assert.equal(uploaded.durationSeconds, 95.2);
    assert.equal(uploaded.sizeBytes, clip.length);
    const saved = await readFile(path.join(root, uploaded.storedFileName));
    assert.deepEqual(saved, clip);

    const webmFile = webm(40);
    const webmUpload = await writeVideoUpload(
      multipart(
        { title: "Welcome", durationSeconds: "12" },
        { name: "intro.webm", type: "video/webm", data: webmFile },
      ),
      { root, maxBytes: webmFile.length },
    );
    assert.ok(webmUpload.storedFileName.endsWith(".webm"));

    await assert.rejects(
      () =>
        writeVideoUpload(
          multipart(
            { title: "Too big", durationSeconds: "3" },
            { name: "big.mp4", type: "video/mp4", data: mp4(80) },
          ),
          { root, maxBytes: 32 },
        ),
      (error: unknown) => error instanceof MediaError && error.status === 413,
    );

    await assert.rejects(
      () =>
        writeVideoUpload(
          multipart(
            { title: "Notes", durationSeconds: "3" },
            { name: "notes.mp4", type: "video/mp4", data: Buffer.from("this is plain text padded!!") },
          ),
          { root, maxBytes: 1024 },
        ),
      (error: unknown) => error instanceof MediaError && error.status === 400,
    );

    await assert.rejects(
      () =>
        writeVideoUpload(
          multipart(
            { title: "Wrong type", durationSeconds: "3" },
            { name: "clip.bin", type: "application/octet-stream", data: mp4(32) },
          ),
          { root, maxBytes: 1024 },
        ),
      (error: unknown) => error instanceof MediaError && error.status === 400,
    );

    await assert.rejects(
      () =>
        writeVideoUpload(
          multipart(
            { title: "Movie", durationSeconds: "3" },
            { name: "clip.mov", type: "video/mp4", data: mp4(64, "qt  ") },
          ),
          { root, maxBytes: 1024 },
        ),
      (error: unknown) => error instanceof MediaError && error.status === 400,
    );

    await assert.rejects(
      () =>
        writeVideoUpload(
          multipart(
            { durationSeconds: "3" },
            { name: "clip.mp4", type: "video/mp4", data: mp4(32) },
          ),
          { root, maxBytes: 1024 },
        ),
      (error: unknown) => error instanceof MediaError && error.status === 400,
    );

    await assert.rejects(
      () =>
        writeVideoUpload(
          multipart(
            { title: "Twice", durationSeconds: "3" },
            { name: "a.mp4", type: "video/mp4", data: mp4(32) },
            { name: "b.mp4", type: "video/mp4", data: mp4(32) },
          ),
          { root, maxBytes: 1024 },
        ),
      (error: unknown) => error instanceof MediaError && error.status === 400,
    );

    const multi = await writeVideoUpload(
      multipart(
        { title: "Two parts", durationSeconds: "10" },
        { name: "a.mp4", type: "video/mp4", data: mp4(32) },
        { name: "b.webm", type: "video/webm", data: webm(32), durationSeconds: "4" },
      ),
      { root, maxBytes: 1024 },
    );
    assert.equal(multi.videos.length, 2);
    assert.equal(multi.videos[0]?.durationSeconds, 10);
    assert.equal(multi.videos[1]?.durationSeconds, 4);
    assert.ok(multi.videos[1]?.storedFileName.endsWith(".webm"));
    assert.deepEqual(multi.keep, []);

    const keptOnly = await writeVideoUpload(fieldsOnly({ title: "Kept", description: "Still here" }, [`${id}.mp4`]), {
      root,
      requireFile: false,
    });
    assert.equal(keptOnly.videos.length, 0);
    assert.deepEqual(keptOnly.keep, [`${id}.mp4`]);
    assert.equal(keptOnly.title, "Kept");
    assert.equal(keptOnly.description, "Still here");

    await assert.rejects(
      () => writeVideoUpload(fieldsOnly({ title: "Empty" }, []), { root }),
      (error: unknown) => error instanceof MediaError && error.status === 400,
    );

    const names = await readdir(root);
    assert.deepEqual(
      names.filter((name) => name.startsWith(".upload-") || name.endsWith(".part")),
      [],
    );
    assert.ok(names.includes(uploaded.storedFileName));
    assert.ok(names.includes(webmUpload.storedFileName));

    const mediaPath = path.join(root, uploaded.storedFileName);
    await writeFile(mediaPath, Buffer.from("0123456789abcdef"));
    const partial = await fileRangeResponse(
      new Request("http://localhost/video", { headers: { range: "bytes=0-4" } }),
      mediaPath,
      "video/mp4",
      'bad"\r\nname.mp4',
    );
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), "bytes 0-4/16");
    assert.equal(partial.headers.get("content-length"), "5");
    assert.equal(partial.headers.get("accept-ranges"), "bytes");
    const disposition = partial.headers.get("content-disposition") ?? "";
    assert.match(disposition, /^inline; filename="[^"\r\n]*"$/);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), Buffer.from("01234"));

    const head = await fileRangeResponse(
      new Request("http://localhost/video", { method: "HEAD", headers: { range: "bytes=0-" } }),
      mediaPath,
      "video/mp4",
      "lesson 1.mp4",
    );
    assert.equal(head.status, 206);
    assert.equal(head.headers.get("content-length"), "16");
    assert.equal(await head.text(), "");

    const full = await fileRangeResponse(
      new Request("http://localhost/video"),
      mediaPath,
      "video/mp4",
      "lesson 1.mp4",
    );
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("content-length"), "16");
    assert.equal(full.headers.get("content-range"), null);
    assert.equal(Buffer.from(await full.arrayBuffer()).toString(), "0123456789abcdef");

    const missing = await fileRangeResponse(
      new Request("http://localhost/video", { headers: { range: "bytes=40-" } }),
      mediaPath,
      "video/mp4",
      "lesson 1.mp4",
    );
    assert.equal(missing.status, 416);
    assert.equal(missing.headers.get("content-range"), "bytes */16");
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  console.log("media tests passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
