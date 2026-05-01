import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const reminderLogsTable = pgTable("reminder_logs", {
  id: text("id").primaryKey(),
  task_id: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  user_email: text("user_email").notNull(),
  reminder_type: text("reminder_type").notNull(),
  reminder_datetime: text("reminder_datetime").notNull(),
  email_sent: boolean("email_sent").notNull().default(false),
  sent_at: text("sent_at"),
  error_message: text("error_message"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReminderLogSchema = createInsertSchema(reminderLogsTable).omit({
  created_at: true,
});
export type InsertReminderLog = z.infer<typeof insertReminderLogSchema>;
export type ReminderLog = typeof reminderLogsTable.$inferSelect;
