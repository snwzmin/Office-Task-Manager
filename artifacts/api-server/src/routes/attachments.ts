import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { taskAttachmentsTable, taskActivityLogsTable, tasksTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, getAuthUser, canAccessTask } from "../lib/auth";
import { generateId } from "../lib/id";

const router: IRouter = Router();

router.get("/tasks/:id/attachments", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const authUser = getAuthUser(req);

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
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
  res.json(
    rows.map((a) => ({
      ...a,
      created_at: a.created_at.toISOString(),
    }))
  );
});

router.post("/tasks/:id/attachments", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const authUser = getAuthUser(req);
  const body = req.body as {
    file_name: string;
    file_url: string;
    file_type: string;
    file_size?: string;
  };

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!task) {
    res.status(404).json({ error: "NotFound", message: "Task not found" });
    return;
  }
  if (!canAccessTask(authUser, task)) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  if (!body.file_name || !body.file_url || !body.file_type) {
    res.status(400).json({ error: "BadRequest", message: "file_name, file_url, file_type required" });
    return;
  }

  const attachmentId = generateId();
  await db.insert(taskAttachmentsTable).values({
    id: attachmentId,
    task_id: id,
    file_name: body.file_name,
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

  res.status(201).json({
    ...attachment,
    created_at: attachment.created_at.toISOString(),
  });
});

export default router;
