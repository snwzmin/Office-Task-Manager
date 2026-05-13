import { Router, type IRouter, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import {
  taskAttachmentsTable,
  taskActivityLogsTable,
  tasksTable,
} from "@workspace/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { requireAuth, getAuthUser, canAccessTask } from "../lib/auth";
import { generateId } from "../lib/id";
import { isS3, streamFromS3, deleteFromS3, S3_BUCKET } from "../lib/storage";
import { UPLOAD_DIR } from "./upload";

/**
 * Derives the R2/S3 object key from an attachment record.
 *
 * Priority order:
 *  1. file_url starts with "s3://" → strip "s3://bucket-name/" prefix
 *  2. file_url starts with "uploads/" or "objects/" → use as-is
 *  3. file_url starts with "/api/uploads/" → legacy local file, return null (caller sends 410)
 *  4. stored_filename present → "uploads/<stored_filename>"
 *  5. fallback → basename of file_url (best-effort)
 */
function getR2ObjectKey(attachment: {
  stored_filename: string | null;
  file_url: string;
}): { key: string; legacy: false } | { key: null; legacy: true } {
  const { file_url, stored_filename } = attachment;

  if (file_url.startsWith("s3://")) {
    // Strip s3://bucket-name/ regardless of bucket name
    const withoutScheme = file_url.slice("s3://".length);
    const slashIdx = withoutScheme.indexOf("/");
    const key = slashIdx !== -1 ? withoutScheme.slice(slashIdx + 1) : withoutScheme;
    return { key, legacy: false };
  }

  if (file_url.startsWith("uploads/") || file_url.startsWith("objects/")) {
    return { key: file_url, legacy: false };
  }

  if (file_url.startsWith("/api/uploads/")) {
    return { key: null, legacy: true };
  }

  if (stored_filename) {
    return { key: `uploads/${stored_filename}`, legacy: false };
  }

  return { key: path.basename(file_url), legacy: false };
}

const router: IRouter = Router();

// ── GET /tasks/:id/attachments ────────────────────────────────────────────────

router.get(
  "/tasks/:id/attachments",
  requireAuth,
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const authUser = getAuthUser(req);

    const [task] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, id))
      .limit(1);
    if (!task) {
      res.status(404).json({ error: "NotFound", message: "Task not found" });
      return;
    }
    if (!canAccessTask(authUser, task)) {
      res.status(403).json({ error: "Forbidden", message: "Access denied" });
      return;
    }

    const rows = await db
      .select()
      .from(taskAttachmentsTable)
      .where(eq(taskAttachmentsTable.task_id, id))
      .orderBy(asc(taskAttachmentsTable.created_at));

    res.json(rows.map((a) => ({ ...a, created_at: a.created_at.toISOString() })));
  }
);

// ── POST /tasks/:id/attachments ───────────────────────────────────────────────

router.post(
  "/tasks/:id/attachments",
  requireAuth,
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const authUser = getAuthUser(req);
    const body = req.body as {
      file_name: string;
      file_url: string;
      file_type: string;
      file_size?: string;
      stored_filename?: string;
    };

    const [task] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, id))
      .limit(1);
    if (!task) {
      res.status(404).json({ error: "NotFound", message: "Task not found" });
      return;
    }
    if (!canAccessTask(authUser, task)) {
      res.status(403).json({ error: "Forbidden", message: "Access denied" });
      return;
    }

    if (!body.file_name || !body.file_url || !body.file_type) {
      res.status(400).json({
        error: "BadRequest",
        message: "file_name, file_url, file_type are required",
      });
      return;
    }

    // stored_filename = R2 object key (e.g. "objects/<uuid>")
    //                  or local disk filename.
    // Derived from file_url basename when not explicitly provided.
    const stored_filename =
      body.stored_filename ?? path.basename(body.file_url);

    const attachmentId = generateId();
    await db.insert(taskAttachmentsTable).values({
      id: attachmentId,
      task_id: id,
      file_name: body.file_name,
      stored_filename,
      file_url: body.file_url,
      file_type: body.file_type,
      file_size: body.file_size,
      uploaded_by_email: authUser.email,
      uploaded_by_name: authUser.name,
    });

    await db.insert(taskActivityLogsTable).values({
      id: generateId(),
      task_id: id,
      user_email: authUser.email,
      user_name: authUser.name,
      action_type: "attachment_uploaded",
      action_details: `File "${body.file_name}" attached`,
    });

    const [attachment] = await db
      .select()
      .from(taskAttachmentsTable)
      .where(eq(taskAttachmentsTable.id, attachmentId))
      .limit(1);

    res
      .status(201)
      .json({ ...attachment, created_at: attachment.created_at.toISOString() });
  }
);

// ── GET /tasks/:taskId/attachments/:attachmentId/download ─────────────────────
//
// Verifies auth + task access, then:
//   S3 mode  → fetches object from R2 server-side and streams to browser.
//              Incognito/unauthenticated requests get 401 — no direct R2 URL.
//   Local    → streams the file from disk with Content-Disposition.

router.get(
  "/tasks/:taskId/attachments/:attachmentId/download",
  requireAuth,
  async (req: Request, res: Response) => {
    const { taskId, attachmentId } = req.params as {
      taskId: string;
      attachmentId: string;
    };
    const authUser = getAuthUser(req);

    const [task] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .limit(1);
    if (!task) {
      res.status(404).json({ error: "NotFound", message: "Task not found" });
      return;
    }
    if (!canAccessTask(authUser, task)) {
      res.status(403).json({ error: "Forbidden", message: "Access denied" });
      return;
    }

    const [attachment] = await db
      .select()
      .from(taskAttachmentsTable)
      .where(
        and(
          eq(taskAttachmentsTable.id, attachmentId),
          eq(taskAttachmentsTable.task_id, taskId)
        )
      )
      .limit(1);

    if (!attachment) {
      res
        .status(404)
        .json({ error: "NotFound", message: "Attachment not found" });
      return;
    }

    // ── S3 / R2 — server-side stream ─────────────────────────────────────────
    if (isS3()) {
      const r2Key = getR2ObjectKey(attachment);

      // In S3 mode, a /api/uploads/ URL means the file was stored locally
      // before R2 was configured — it no longer exists in the bucket.
      if (r2Key.legacy) {
        res.status(410).json({
          error: "Gone",
          message:
            "This attachment was stored locally and is no longer available. Re-upload the file.",
        });
        return;
      }

      const objectKey = r2Key.key;
      try {
        const { stream, contentType, contentLength } =
          await streamFromS3(objectKey);

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(attachment.file_name)}"`
        );
        res.setHeader("Content-Type", attachment.file_type || contentType);
        res.setHeader("Cache-Control", "no-store");
        if (contentLength) res.setHeader("Content-Length", String(contentLength));

        stream.pipe(res);
      } catch (err: unknown) {
        console.error(
          "[download] R2 stream failed:",
          {
            attachmentId: attachment.id,
            taskId,
            stored_filename: attachment.stored_filename,
            file_url: attachment.file_url,
            objectKey,
            bucket: S3_BUCKET,
          },
          err
        );
        const isNoSuchKey =
          err instanceof Error && err.name === "NoSuchKey";
        if (isNoSuchKey) {
          res
            .status(404)
            .json({ error: "NotFound", message: "File not found in storage" });
        } else {
          res
            .status(502)
            .json({ error: "StorageError", message: "Could not retrieve file" });
        }
      }
      return;
    }

    // ── Local disk ────────────────────────────────────────────────────────────
    // In local mode, stored_filename is the bare filename on disk.
    // file_url may be "/api/uploads/<name>" (current) or a legacy path — fall
    // back to path.basename so both formats resolve to the disk filename.
    const localFilename =
      attachment.stored_filename ?? path.basename(attachment.file_url);
    const filePath = path.join(UPLOAD_DIR, path.basename(localFilename));
    if (!fs.existsSync(filePath)) {
      res
        .status(404)
        .json({ error: "NotFound", message: "File not found on disk" });
      return;
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(attachment.file_name)}"`
    );
    res.setHeader("Content-Type", attachment.file_type);
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(filePath);
  }
);

// ── DELETE /tasks/:taskId/attachments/:attachmentId ───────────────────────────
//
// Removes the DB record and best-effort deletes the R2 object (or local file).
// Only admin or the original uploader may delete.

router.delete(
  "/tasks/:taskId/attachments/:attachmentId",
  requireAuth,
  async (req: Request, res: Response) => {
    const { taskId, attachmentId } = req.params as {
      taskId: string;
      attachmentId: string;
    };
    const authUser = getAuthUser(req);

    const [task] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .limit(1);
    if (!task) {
      res.status(404).json({ error: "NotFound", message: "Task not found" });
      return;
    }
    if (!canAccessTask(authUser, task)) {
      res.status(403).json({ error: "Forbidden", message: "Access denied" });
      return;
    }

    const [attachment] = await db
      .select()
      .from(taskAttachmentsTable)
      .where(
        and(
          eq(taskAttachmentsTable.id, attachmentId),
          eq(taskAttachmentsTable.task_id, taskId)
        )
      )
      .limit(1);

    if (!attachment) {
      res
        .status(404)
        .json({ error: "NotFound", message: "Attachment not found" });
      return;
    }

    // Any user who can access the task may delete its attachments

    const r2DeleteKey = getR2ObjectKey(attachment);
    const objectKey = r2DeleteKey.legacy ? null : r2DeleteKey.key;

    // Delete DB record first — storage cleanup is best-effort
    await db
      .delete(taskAttachmentsTable)
      .where(eq(taskAttachmentsTable.id, attachmentId));

    // Attempt storage cleanup (skip for legacy local-storage records)
    if (objectKey === null) {
      console.log(`[delete] Legacy local file record removed from DB (no R2 object to clean up): ${attachmentId}`);
    } else if (isS3()) {
      try {
        await deleteFromS3(objectKey);
        console.log(`[delete] R2 object removed: ${objectKey}`);
      } catch (err) {
        console.error(
          `[delete] R2 cleanup failed for key="${objectKey}" — DB record already removed:`,
          err
        );
      }
    } else {
      const filePath = path.join(UPLOAD_DIR, path.basename(objectKey));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`[delete] Local file cleanup failed: ${filePath}`, err);
        }
      }
    }

    res.status(204).end();
  }
);

export default router;
