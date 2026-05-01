import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const actionTypeEnum = pgEnum("action_type", [
  "created",
  "assigned",
  "status_changed",
  "priority_changed",
  "due_date_changed",
  "comment_added",
  "attachment_uploaded",
  "reminder_sent",
  "completed",
  "archived",
  "restored",
  "edited",
]);

export const taskActivityLogsTable = pgTable("task_activity_logs", {
  id: text("id").primaryKey(),
  task_id: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  user_email: text("user_email").notNull(),
  user_name: text("user_name").notNull(),
  action_type: actionTypeEnum("action_type").notNull(),
  action_details: text("action_details"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskActivityLogSchema = createInsertSchema(taskActivityLogsTable).omit({
  created_at: true,
});
export type InsertTaskActivityLog = z.infer<typeof insertTaskActivityLogSchema>;
export type TaskActivityLog = typeof taskActivityLogsTable.$inferSelect;
