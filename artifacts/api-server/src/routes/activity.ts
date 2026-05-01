import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { taskActivityLogsTable, tasksTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getAuthUser, canAccessTask } from "../lib/auth";

const router: IRouter = Router();

router.get("/tasks/:id/activity", requireAuth, async (req: Request, res: Response) => {
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
    .from(taskActivityLogsTable)
    .where(eq(taskActivityLogsTable.task_id, id))
    .orderBy(desc(taskActivityLogsTable.created_at));
  res.json(
    rows.map((a) => ({
      ...a,
      created_at: a.created_at.toISOString(),
    }))
  );
});

export default router;
