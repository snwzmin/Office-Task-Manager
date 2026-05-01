import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { taskCommentsTable, taskActivityLogsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, getAuthUser } from "../lib/auth";
import { generateId } from "../lib/id";

const router: IRouter = Router();

router.get("/tasks/:id/comments", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const rows = await db
    .select()
    .from(taskCommentsTable)
    .where(eq(taskCommentsTable.task_id, id))
    .orderBy(asc(taskCommentsTable.created_at));
  res.json(
    rows.map((c) => ({
      ...c,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
    }))
  );
});

router.post("/tasks/:id/comments", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = getAuthUser(req);
  const { comment_text } = req.body as { comment_text: string };

  if (!comment_text?.trim()) {
    res.status(400).json({ error: "BadRequest", message: "comment_text is required" });
    return;
  }

  const commentId = generateId();
  await db.insert(taskCommentsTable).values({
    id: commentId,
    task_id: id,
    user_email: authUser.email,
    user_name: authUser.name,
    comment_text,
  });

  await db.insert(taskActivityLogsTable).values({
    id: generateId(),
    task_id: id,
    user_email: authUser.email,
    user_name: authUser.name,
    action_type: "comment_added",
    action_details: `Comment added by ${authUser.name}`,
  });

  const [comment] = await db
    .select()
    .from(taskCommentsTable)
    .where(eq(taskCommentsTable.id, commentId))
    .limit(1);

  res.status(201).json({
    ...comment,
    created_at: comment.created_at.toISOString(),
    updated_at: comment.updated_at.toISOString(),
  });
});

export default router;
