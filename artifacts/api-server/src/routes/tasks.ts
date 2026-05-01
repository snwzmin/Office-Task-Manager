import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  tasksTable,
  taskActivityLogsTable,
} from "@workspace/db/schema";
import { eq, and, or, ilike, lte, gte, desc } from "drizzle-orm";
import { requireAuth, getAuthUser } from "../lib/auth";
import { generateId } from "../lib/id";

const router: IRouter = Router();

function formatTask(t: typeof tasksTable.$inferSelect) {
  return {
    ...t,
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
  };
}

async function logActivity(
  taskId: string,
  userEmail: string,
  userName: string,
  actionType: typeof taskActivityLogsTable.$inferInsert["action_type"],
  actionDetails?: string
) {
  await db.insert(taskActivityLogsTable).values({
    id: generateId(),
    task_id: taskId,
    user_email: userEmail,
    user_name: userName,
    action_type: actionType,
    action_details: actionDetails,
  });
}

router.get("/tasks", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const {
    search,
    status,
    priority,
    category_id,
    assigned_to,
    created_by,
    is_archived,
    date_from,
    date_to,
    view,
  } = req.query as Record<string, string>;

  let rows = await db.select().from(tasksTable).orderBy(desc(tasksTable.created_at));

  // Role-based filtering
  if (authUser.role !== "admin") {
    rows = rows.filter(
      (t) => t.assigned_to === authUser.email || t.created_by === authUser.email
    );
  }

  // View-based filtering
  if (view === "my_tasks") {
    rows = rows.filter((t) => t.assigned_to === authUser.email);
  } else if (view === "created_by_me") {
    rows = rows.filter((t) => t.created_by === authUser.email);
  } else if (view === "delegated") {
    rows = rows.filter(
      (t) =>
        t.created_by === authUser.email &&
        t.assigned_to &&
        t.assigned_to !== authUser.email
    );
  }

  // Archive filter
  const archivedFilter = is_archived === "true";
  rows = rows.filter((t) => t.is_archived === archivedFilter);

  // Search
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.reference_number?.toLowerCase().includes(q) ?? false) ||
        (t.source_department?.toLowerCase().includes(q) ?? false) ||
        (t.tags?.toLowerCase().includes(q) ?? false) ||
        (t.assigned_to_name?.toLowerCase().includes(q) ?? false)
    );
  }

  if (status) rows = rows.filter((t) => t.status === status);
  if (priority) rows = rows.filter((t) => t.priority === priority);
  if (category_id) rows = rows.filter((t) => t.category_id === category_id);
  if (assigned_to) rows = rows.filter((t) => t.assigned_to === assigned_to);
  if (created_by) rows = rows.filter((t) => t.created_by === created_by);

  if (date_from) rows = rows.filter((t) => t.due_date >= date_from);
  if (date_to) rows = rows.filter((t) => t.due_date <= date_to);

  res.json(rows.map(formatTask));
});

router.post("/tasks", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const body = req.body as {
    title: string;
    description?: string;
    category_id?: string;
    reference_number?: string;
    source_department?: string;
    assigned_to?: string;
    assigned_to_name?: string;
    priority?: string;
    status?: string;
    start_date?: string;
    due_date: string;
    due_time?: string;
    reminder_option?: string;
    custom_reminder_datetime?: string;
    tags?: string;
  };

  if (!body.title || !body.due_date) {
    res.status(400).json({ error: "BadRequest", message: "title and due_date are required" });
    return;
  }

  const id = generateId();
  await db.insert(tasksTable).values({
    id,
    title: body.title,
    description: body.description,
    category_id: body.category_id,
    reference_number: body.reference_number,
    source_department: body.source_department,
    assigned_to: body.assigned_to,
    assigned_to_name: body.assigned_to_name,
    created_by: authUser.email,
    created_by_name: authUser.name,
    priority: (body.priority as typeof tasksTable.$inferInsert["priority"]) || "medium",
    status: (body.status as typeof tasksTable.$inferInsert["status"]) || "not_started",
    start_date: body.start_date,
    due_date: body.due_date,
    due_time: body.due_time,
    reminder_option: (body.reminder_option as typeof tasksTable.$inferInsert["reminder_option"]) || "none",
    custom_reminder_datetime: body.custom_reminder_datetime,
    tags: body.tags,
  });

  await logActivity(id, authUser.email, authUser.name, "created", `Task "${body.title}" created`);

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  res.status(201).json(formatTask(task));
});

router.get("/tasks/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = getAuthUser(req);
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!task) {
    res.status(404).json({ error: "NotFound", message: "Task not found" });
    return;
  }
  if (
    authUser.role !== "admin" &&
    task.assigned_to !== authUser.email &&
    task.created_by !== authUser.email
  ) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }
  res.json(formatTask(task));
});

router.put("/tasks/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = getAuthUser(req);
  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "NotFound", message: "Task not found" });
    return;
  }

  const body = req.body as Partial<typeof tasksTable.$inferInsert>;
  const changes: string[] = [];

  if (body.status && body.status !== existing.status) {
    changes.push(`status: ${existing.status} → ${body.status}`);
    await logActivity(id, authUser.email, authUser.name, "status_changed", `Status changed from "${existing.status}" to "${body.status}"`);
  }
  if (body.priority && body.priority !== existing.priority) {
    changes.push(`priority: ${existing.priority} → ${body.priority}`);
    await logActivity(id, authUser.email, authUser.name, "priority_changed", `Priority changed from "${existing.priority}" to "${body.priority}"`);
  }
  if (body.due_date && body.due_date !== existing.due_date) {
    await logActivity(id, authUser.email, authUser.name, "due_date_changed", `Due date changed to "${body.due_date}"`);
  }
  if (body.assigned_to && body.assigned_to !== existing.assigned_to) {
    await logActivity(id, authUser.email, authUser.name, "assigned", `Assigned to "${body.assigned_to_name || body.assigned_to}"`);
  }
  if (changes.length === 0) {
    await logActivity(id, authUser.email, authUser.name, "edited", "Task details updated");
  }

  const completedAt =
    body.status === "completed" && existing.status !== "completed"
      ? new Date().toISOString()
      : existing.completed_at;

  await db
    .update(tasksTable)
    .set({
      ...body,
      completed_at: completedAt,
      updated_at: new Date(),
    })
    .where(eq(tasksTable.id, id));

  const [updated] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  res.json(formatTask(updated));
});

router.delete("/tasks/:id", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (authUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }
  const { id } = req.params;
  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "NotFound", message: "Task not found" });
    return;
  }
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  res.status(204).send();
});

router.post("/tasks/:id/archive", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = getAuthUser(req);
  const body = req.body as { is_archived: boolean };

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "NotFound", message: "Task not found" });
    return;
  }

  await db
    .update(tasksTable)
    .set({ is_archived: body.is_archived, updated_at: new Date() })
    .where(eq(tasksTable.id, id));

  await logActivity(
    id,
    authUser.email,
    authUser.name,
    body.is_archived ? "archived" : "restored",
    body.is_archived ? "Task archived" : "Task restored"
  );

  const [updated] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  res.json(formatTask(updated));
});

router.post("/tasks/:id/status", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = getAuthUser(req);
  const { status } = req.body as { status: string };

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "NotFound", message: "Task not found" });
    return;
  }

  const completedAt =
    status === "completed" ? new Date().toISOString() : existing.completed_at;

  await db
    .update(tasksTable)
    .set({
      status: status as typeof tasksTable.$inferInsert["status"],
      completed_at: completedAt,
      updated_at: new Date(),
    })
    .where(eq(tasksTable.id, id));

  await logActivity(
    id,
    authUser.email,
    authUser.name,
    status === "completed" ? "completed" : "status_changed",
    `Status changed to "${status}"`
  );

  const [updated] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  res.json(formatTask(updated));
});

export default router;
