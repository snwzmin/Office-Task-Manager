import {
  pgTable,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { usersTable } from "./users";

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "not_started",
  "in_progress",
  "waiting_for_response",
  "deferred",
  "completed",
  "cancelled",
]);

export const reminderOptionEnum = pgEnum("reminder_option", [
  "none",
  "on_due",
  "15min_before",
  "1hr_before",
  "2hr_before",
  "1day_before",
  "custom",
]);

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category_id: text("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  reference_number: text("reference_number"),
  source_department: text("source_department"),
  assigned_to: text("assigned_to").references(() => usersTable.email, { onDelete: "set null" }),
  assigned_to_name: text("assigned_to_name"),
  created_by: text("created_by").notNull().references(() => usersTable.email, { onDelete: "restrict" }),
  created_by_name: text("created_by_name").notNull(),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  status: taskStatusEnum("status").notNull().default("not_started"),
  start_date: text("start_date"),
  due_date: text("due_date").notNull(),
  due_time: text("due_time"),
  reminder_option: reminderOptionEnum("reminder_option").notNull().default("none"),
  custom_reminder_datetime: text("custom_reminder_datetime"),
  tags: text("tags"),
  is_archived: boolean("is_archived").notNull().default(false),
  completed_at: text("completed_at"),
  reminder_sent: boolean("reminder_sent").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  created_at: true,
  updated_at: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
