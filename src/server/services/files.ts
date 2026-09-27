import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedFiles } from "@/db/schema";
import { AppError } from "@/lib/errors";

export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

const SIGNATURES: Record<(typeof ALLOWED_UPLOAD_TYPES)[number], (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  "application/pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
};

/** Stores a user upload after validating size, declared type and the file's magic bytes. */
export async function saveUpload(ownerId: string, file: File, purpose: string) {
  if (file.size === 0) throw new AppError("The selected file is empty");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("Files must be 3MB or smaller");
  const type = file.type as (typeof ALLOWED_UPLOAD_TYPES)[number];
  if (!ALLOWED_UPLOAD_TYPES.includes(type)) throw new AppError("Upload a JPG, PNG, WEBP or PDF file");
  const data = Buffer.from(await file.arrayBuffer());
  if (!SIGNATURES[type](data)) throw new AppError("The file doesn't match its type. Please upload the original image or PDF.");
  const sha256 = createHash("sha256").update(data).digest("hex");
  const [row] = await db
    .insert(uploadedFiles)
    .values({ ownerId, purpose, mimeType: type, sizeBytes: file.size, sha256, data })
    .returning({ id: uploadedFiles.id });
  return row.id;
}

export async function getFile(id: string) {
  const [row] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id)).limit(1);
  return row ?? null;
}
