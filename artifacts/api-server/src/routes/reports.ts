import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db/schema";
import { requireAuth, getAuthUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/reports/summary", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const { date_from, date_to } = req.query as { date_from?: string; date_to?: string };

  const today = new Date().toISOString().slice(0, 10);

  let allTasks = await db.select().from(tasksTable);

  if (authUser.role !== "admin") {
    allTasks = allTasks.filter(
      (t) => t.assigned_to === authUser.email || t.created_by === authUser.email
    );
  }

  let tasks = allTasks.filter((t) => !t.is_archived);

  if (date_from) tasks = tasks.filter((t) => t.due_date >= date_from);
  if (date_to) tasks = tasks.filter((t) => t.due_date <= date_to);

  // By status
  const byStatusMap: Record<string, number> = {};
  for (const t of tasks) {
    byStatusMap[t.status] = (byStatusMap[t.status] || 0) + 1;
  }
  const by_status = Object.entries(byStatusMap).map(([status, count]) => ({ status, count }));

  // By priority
  const byPriorityMap: Record<string, number> = {};
  for (const t of tasks) {
    byPriorityMap[t.priority] = (byPriorityMap[t.priority] || 0) + 1;
  }
  const by_priority = Object.entries(byPriorityMap).map(([priority, count]) => ({ priority, count }));

  // By user
  const byUserMap: Record<string, number> = {};
  for (const t of tasks) {
    const name = t.assigned_to_name || t.assigned_to || "Unassigned";
    byUserMap[name] = (byUserMap[name] || 0) + 1;
  }
  const by_user = Object.entries(byUserMap).map(([user_name, count]) => ({ user_name, count }));

  // By department
  const byDeptMap: Record<string, number> = {};
  for (const t of tasks) {
    const dept = t.source_department || "Unknown";
    byDeptMap[dept] = (byDeptMap[dept] || 0) + 1;
  }
  const by_department = Object.entries(byDeptMap).map(([department, count]) => ({ department, count }));

  // Overdue by priority
  const overdueByPriorityMap: Record<string, number> = {};
  for (const t of tasks.filter(
    (t) => t.due_date < today && t.status !== "completed" && t.status !== "cancelled"
  )) {
    overdueByPriorityMap[t.priority] = (overdueByPriorityMap[t.priority] || 0) + 1;
  }
  const overdue_by_priority = Object.entries(overdueByPriorityMap).map(([priority, count]) => ({ priority, count }));

  res.json({
    by_status,
    by_priority,
    by_user,
    by_department,
    overdue_by_priority,
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter(
      (t) => t.due_date < today && t.status !== "completed" && t.status !== "cancelled"
    ).length,
  });
});

export default router;
