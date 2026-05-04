import { Router, type IRouter, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { taskAttachmentsTable, taskActivityLogsTable, tasksTable } from "@workspace/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { requireAuth, getAuthUser, canAccessTask } from "../lib/auth";
import { generateId } from "../lib/id";
import { isS3, getPresignedDownloadUrl } from "../lib/storage";
import { UPLOAD_DIR } from "./upload";

const router: IRouter = Router();

// ── GET /tasks/:id/attachments ────────────────────────────────────────────────

router.get("/tasks/:id/attachments", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const authUser = getAuthUser(req);

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!task) { res.status(404).json({ error: "NotFound", message: "Task not found" }); return; }
  if (!canAccessTask(authUser, task)) { res.status(403).json({ error: "Forbidden", message: "Access denied" }); return; }

  const rows = await db
    .select()
    .from(taskAttachmentsTable)
    .where(eq(taskAttachmentsTable.task_id, id))
    .orderBy(asc(taskAttachmentsTable.created_at));

  res.json(rows.map((a) => ({ ...a, created_at: a.created_at.toISOString() })));
});

// ── POST /tasks/:id/attachments ───────────────────────────────────────────────

router.post("/tasks/:id/attachments", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const authUser = getAuthUser(req);
  const body = req.body as {
    file_name: string;
    file_url: string;
    file_type: string;
    file_size?: string;
    stored_filename?: string;
  };

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!task) { res.status(404).json({ error: "NotFound", message: "Task not found" }); return; }
  if (!canAccessTask(authUser, task)) { res.status(403).json({ error: "Forbidden", message: "Access denied" }); return; }

  if (!body.file_name || !body.file_url || !body.file_type) {
    res.status(400).json({ error: "BadRequest", message: "file_name, file_url, file_type required" });
    return;
  }

  // stored_filename = S3 object key (e.g. "uploads/1234-abc.pdf")
  //                  or local disk filename — derived from file_url if not sent
  const stored_filename = body.stored_filename ?? path.basename(body.file_url);

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

  res.status(201).json({ ...attachment, created_at: attachment.created_at.toISOString() });
});

// ── GET /tasks/:taskId/attachments/:attachmentId/download ─────────────────────
//
// S3 mode  → verifies auth + task access, returns a 15-min presigned URL in JSON.
//            The frontend opens the URL directly — no CORS needed.
// Local    → verifies auth + task access, streams the file with Content-Disposition.

router.get(
  "/tasks/:taskId/attachments/:attachmentId/download",
  requireAuth,
  async (req: Request, res: Response) => {
    const { taskId, attachmentId } = req.params as { taskId: string; attachmentId: string };
    const authUser = getAuthUser(req);

    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
    if (!task) { res.status(404).json({ error: "NotFound", message: "Task not found" }); return; }
    if (!canAccessTask(authUser, task)) { res.status(403).json({ error: "Forbidden", message: "Access denied" }); return; }

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
      res.status(404).json({ error: "NotFound", message: "Attachment not found" });
      return;
    }

    const objectKey =
      attachment.stored_filename ?? path.basename(attachment.file_url);

    // ── S3 / R2 ───────────────────────────────────────────────────────────────
    if (isS3()) {
      try {
        const download_url = await getPresignedDownloadUrl(
          objectKey,
          attachment.file_name,
          900 // 15 minutes
        );
        // Return JSON — frontend opens URL directly; avoids any CORS complexity
        res.json({ download_url });
      } catch (err) {
        console.error("[download] Failed to generate presigned URL:", err);
        res.status(502).json({ error: "StorageError", message: "Could not generate download link" });
      }
      return;
    }

    // ── Local disk ────────────────────────────────────────────────────────────
    const filePath = path.join(UPLOAD_DIR, path.basename(objectKey));
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "NotFound", message: "File not found on disk" });
      return;
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(attachment.file_name)}"`
    );
    res.setHeader("Content-Type", attachment.file_type);
    res.sendFile(filePath);
  }
);

export default router;
