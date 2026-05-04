import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? "local";

export function isS3(): boolean {
  return STORAGE_PROVIDER === "s3";
}

const S3_BUCKET = process.env.S3_BUCKET ?? "task-files-prod";

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

/**
 * Returns a short-lived (15 min) presigned download URL.
 * ResponseContentDisposition ensures the browser saves the file
 * with the original filename, not the generated object key.
 */
export async function getPresignedDownloadUrl(
  key: string,
  originalFilename: string,
  expiresInSeconds = 900
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
  });
  return getSignedUrl(s3(), command, { expiresIn: expiresInSeconds });
}
