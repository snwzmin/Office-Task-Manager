import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, getAuthUser } from "../lib/auth";

const router: IRouter = Router();

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function getUserTaskFilter(
  tasks: typeof tasksTable.$inferSelect[],
  userEmail: string,
  role: string
) {
  if (role === "admin") return tasks;
  return tasks.filter(
    (t) => t.assigned_to === userEmail || t.created_by === userEmail
  );
}

router.get("/dashboard/summary", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const allTasks = await db.select().from(tasksTable);
  const tasks = getUserTaskFilter(allTasks, authUser.email, authUser.role);
  const active = tasks.filter((t) => !t.is_archived);

  const today = getTodayStr();
  const weekStart = getWeekStartStr();

  res.json({
    total_tasks: active.length,
    pending_tasks: active.filter(
      (t) => t.status !== "completed" && t.status !== "cancelled"
    ).length,
    due_today: active.filter(
      (t) => t.due_date === today && t.status !== "completed" && t.status !== "cancelled"
    ).length,
    overdue: active.filter(
      (t) =>
        t.due_date < today &&
        t.status !== "completed" &&
        t.status !== "cancelled"
    ).length,
    completed_this_week: active.filter(
      (t) =>
        t.status === "completed" &&
        t.completed_at &&
        t.completed_at.slice(0, 10) >= weekStart
    ).length,
    high_priority: active.filter(
      (t) =>
        (t.priority === "high" || t.priority === "urgent") &&
        t.status !== "completed" &&
        t.status !== "cancelled"
    ).length,
  });
});

router.get("/dashboard/tasks-by-status", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const allTasks = await db.select().from(tasksTable);
  const tasks = getUserTaskFilter(allTasks, authUser.email, authUser.role).filter(
    (t) => !t.is_archived
  );

  const counts: Record<string, number> = {};
  for (const t of tasks) {
    counts[t.status] = (counts[t.status] || 0) + 1;
  }

  res.json(
    Object.entries(counts).map(([status, count]) => ({ status, count }))
  );
});

router.get("/dashboard/tasks-by-priority", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const allTasks = await db.select().from(tasksTable);
  const tasks = getUserTaskFilter(allTasks, authUser.email, authUser.role).filter(
    (t) => !t.is_archived && t.status !== "completed" && t.status !== "cancelled"
  );

  const counts: Record<string, number> = {};
  for (const t of tasks) {
    counts[t.priority] = (counts[t.priority] || 0) + 1;
  }

  res.json(
    Object.entries(counts).map(([priority, count]) => ({ priority, count }))
  );
});

router.get("/dashboard/due-today", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const today = getTodayStr();
  const allTasks = await db.select().from(tasksTable);
  const tasks = getUserTaskFilter(allTasks, authUser.email, authUser.role).filter(
    (t) =>
      !t.is_archived &&
      t.due_date === today &&
      t.status !== "completed" &&
      t.status !== "cancelled"
  );
  res.json(tasks.map((t) => ({ ...t, created_at: t.created_at.toISOString(), updated_at: t.updated_at.toISOString() })));
});

router.get("/dashboard/overdue", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const today = getTodayStr();
  const allTasks = await db.select().from(tasksTable);
  const tasks = getUserTaskFilter(allTasks, authUser.email, authUser.role).filter(
    (t) =>
      !t.is_archived &&
      t.due_date < today &&
      t.status !== "completed" &&
      t.status !== "cancelled"
  );
  res.json(tasks.map((t) => ({ ...t, created_at: t.created_at.toISOString(), updated_at: t.updated_at.toISOString() })));
});

router.get("/dashboard/upcoming", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const today = getTodayStr();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);

  const allTasks = await db.select().from(tasksTable);
  const tasks = getUserTaskFilter(allTasks, authUser.email, authUser.role).filter(
    (t) =>
      !t.is_archived &&
      t.due_date > today &&
      t.due_date <= nextWeekStr &&
      t.status !== "completed" &&
      t.status !== "cancelled"
  );
  res.json(tasks.map((t) => ({ ...t, created_at: t.created_at.toISOString(), updated_at: t.updated_at.toISOString() })));
});

export default router;
