import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, getAuthUser } from "../lib/auth";
import { isS3, uploadToS3 } from "../lib/storage";

// ── Local storage dir (only used when STORAGE_PROVIDER !== "s3") ──────────────

export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ??
  process.env.UPLOADS_DIR ??
  path.resolve(process.cwd(), "uploads");

if (!isS3() && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Shared allow-lists ────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
]);

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed. Accepted: PDF, Word, Excel, PowerPoint, JPEG, PNG"));
  }
}

// S3 mode — buffer in memory, push to R2 after multer finishes
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter,
});

// Local mode — write straight to disk
const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter,
});

const uploadMiddleware = isS3() ? memoryUpload : diskUpload;

// ── Error handler ─────────────────────────────────────────────────────────────

function handleUploadError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "FileTooLarge", message: "File size must be under 20 MB" });
    } else {
      res.status(400).json({ error: "UploadError", message: err.message });
    }
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: "UploadError", message: err.message });
    return;
  }
  next(err);
}

// ── Router ────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

router.post(
  "/upload",
  requireAuth,
  uploadMiddleware.single("file"),
  handleUploadError,
  async (req: Request, res: Response) => {
    getAuthUser(req);
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "BadRequest", message: "No file provided" });
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const generatedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    if (isS3()) {
      const objectKey = `uploads/${generatedName}`;
      try {
        await uploadToS3(objectKey, file.buffer, file.mimetype);
      } catch (err) {
        console.error("[upload] R2 upload failed:", err);
        res.status(502).json({ error: "StorageError", message: "Failed to upload file to storage" });
        return;
      }
      res.status(201).json({
        file_name: file.originalname,
        stored_filename: objectKey,
        file_url: `s3://${process.env.S3_BUCKET ?? "task-files-prod"}/${objectKey}`,
        file_type: file.mimetype,
        file_size: `${(file.size / 1024).toFixed(1)} KB`,
      });
    } else {
      res.status(201).json({
        file_name: file.originalname,
        stored_filename: file.filename,
        file_url: `/api/uploads/${file.filename}`,
        file_type: file.mimetype,
        file_size: `${(file.size / 1024).toFixed(1)} KB`,
      });
    }
  }
);

export default router;
