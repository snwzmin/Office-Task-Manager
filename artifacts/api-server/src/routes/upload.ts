import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, getAuthUser } from "../lib/auth";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${ts}-${rand}${ext}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed. Accepted: PDF, Word, Excel, PowerPoint, JPEG, PNG"));
    }
  },
});

const router: IRouter = Router();

function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction): void {
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

router.post(
  "/upload",
  requireAuth,
  uploadMiddleware.single("file"),
  handleUploadError,
  (req: Request, res: Response) => {
    getAuthUser(req);

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "BadRequest", message: "No file provided" });
      return;
    }

    const file_url = `/api/uploads/${file.filename}`;
    const file_size = `${(file.size / 1024).toFixed(1)} KB`;

    res.status(201).json({
      file_name: file.originalname,
      file_url,
      file_type: file.mimetype,
      file_size,
    });
  }
);

router.get("/uploads/:filename", requireAuth, (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename as string);
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "NotFound", message: "File not found" });
    return;
  }

  res.sendFile(filePath);
});

export default router;
export { UPLOADS_DIR };
