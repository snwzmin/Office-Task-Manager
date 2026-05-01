import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskCommentsTable = pgTable("task_comments", {
  id: text("id").primaryKey(),
  task_id: text("task_id").notNull(),
  user_email: text("user_email").notNull(),
  user_name: text("user_name").notNull(),
  comment_text: text("comment_text").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskCommentSchema = createInsertSchema(taskCommentsTable).omit({
  created_at: true,
  updated_at: true,
});
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskCommentsTable.$inferSelect;
