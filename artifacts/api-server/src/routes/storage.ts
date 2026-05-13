import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import path from "path";
import { requireAuth } from "../lib/auth";
import { isS3, getPresignedPutUrl } from "../lib/storage";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt",
]);

const MAX_BYTES = 20 * 1024 * 1024;

const router: IRouter = Router();

/**
 * POST /api/storage/uploads/request-url
 *
 * Returns a short-lived presigned PUT URL for browser-direct upload to R2.
 * In local dev mode returns { mode: "local" } so the frontend falls back to
 * the legacy POST /api/upload multipart endpoint.
 *
 * Never exposes R2 secret credentials to the browser.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response) => {
    const body = req.body as {
      file_name?: string;
      file_size?: number;
      content_type?: string;
    };

    const fileName = (body.file_name ?? "").trim();
    const fileSize = Number(body.file_size ?? 0);
    const contentType = (body.content_type ?? "").trim();

    if (!fileName || !fileSize || !contentType) {
      res.status(400).json({
        error: "BadRequest",
        message: "file_name, file_size, and content_type are required",
      });
      return;
    }

    if (fileSize > MAX_BYTES) {
      res.status(400).json({
        error: "FileTooLarge",
        message: "File size must be under 20 MB",
      });
      return;
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      res.status(400).json({
        error: "InvalidFileType",
        message: `File extension "${ext}" is not allowed`,
      });
      return;
    }

    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      res.status(400).json({
        error: "InvalidFileType",
        message: `MIME type "${contentType}" is not allowed`,
      });
      return;
    }

    if (!isS3()) {
      res.json({ mode: "local", upload_url: null, object_key: null });
      return;
    }

    const objectKey = `objects/${randomUUID()}`;
    try {
      const uploadUrl = await getPresignedPutUrl(objectKey, contentType);
      res.json({ mode: "s3", upload_url: uploadUrl, object_key: objectKey });
    } catch (err) {
      console.error("[storage] Failed to generate presigned PUT URL:", err);
      res.status(502).json({
        error: "StorageError",
        message: "Failed to generate upload URL",
      });
    }
  }
);

export default router;
