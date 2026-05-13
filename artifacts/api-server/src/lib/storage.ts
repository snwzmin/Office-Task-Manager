import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "stream";

export const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? "local";

export function isS3(): boolean {
  return STORAGE_PROVIDER === "s3";
}

export const S3_BUCKET = process.env.S3_BUCKET ?? "task-files-prod";

let _s3: S3Client | null = null;

function s3(): S3Client {
  if (!_s3) {
    const endpoint = process.env.S3_ENDPOINT;
    if (!endpoint) {
      throw new Error(
        "S3_ENDPOINT environment variable is required when STORAGE_PROVIDER=s3"
      );
    }
    _s3 = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "auto",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    });
  }
  return _s3;
}

/**
 * Returns a short-lived presigned PUT URL (5 min default) for browser-direct
 * upload to R2.  Secret credentials are never exposed to the browser.
 */
export async function getPresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3(), command, { expiresIn });
}

/**
 * Streams an object from R2 back to the caller.
 * Returns the Node.js Readable stream and metadata.
 * The caller is responsible for piping into the HTTP response.
 */
export async function streamFromS3(key: string): Promise<{
  stream: Readable;
  contentType: string;
  contentLength?: number;
}> {
  const response = await s3().send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
  );
  if (!response.Body) throw new Error("Empty response body from R2");
  return {
    stream: response.Body as unknown as Readable,
    contentType: response.ContentType ?? "application/octet-stream",
    contentLength: response.ContentLength,
  };
}

/**
 * Deletes an object from R2.
 * Throws on failure — caller should catch and log.
 */
export async function deleteFromS3(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

/**
 * Server-side upload helper (used only in local→S3 fallback scenarios).
 */
export async function uploadToS3(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}
