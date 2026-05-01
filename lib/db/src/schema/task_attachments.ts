import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskAttachmentsTable = pgTable("task_attachments", {
  id: text("id").primaryKey(),
  task_id: text("task_id").notNull(),
  file_name: text("file_name").notNull(),
  file_url: text("file_url").notNull(),
  file_type: text("file_type").notNull(),
  file_size: text("file_size"),
  uploaded_by_email: text("uploaded_by_email").notNull(),
  uploaded_by_name: text("uploaded_by_name").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskAttachmentSchema = createInsertSchema(taskAttachmentsTable).omit({
  created_at: true,
});
export type InsertTaskAttachment = z.infer<typeof insertTaskAttachmentSchema>;
export type TaskAttachment = typeof taskAttachmentsTable.$inferSelect;
