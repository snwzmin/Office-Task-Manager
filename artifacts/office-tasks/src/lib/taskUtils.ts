import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isBefore, isThisWeek, isThisMonth, startOfDay } from "date-fns";
import { TaskStatus, ReminderOption } from "@workspace/api-client-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  waiting_for_response: { label: "Waiting", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" },
  deferred: { label: "Deferred", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
};

export const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  high: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
};

export const REMINDER_OPTIONS: { value: ReminderOption; label: string }[] = [
  { value: ReminderOption.none, label: "No Reminder" },
  { value: ReminderOption.on_due, label: "At Due Time" },
  { value: ReminderOption["15min_before"], label: "15 Minutes Before" },
  { value: ReminderOption["1hr_before"], label: "1 Hour Before" },
  { value: ReminderOption["2hr_before"], label: "2 Hours Before" },
  { value: ReminderOption["1day_before"], label: "1 Day Before" },
  { value: ReminderOption.custom, label: "Custom Date/Time" },
];

export type DueStatus = "overdue" | "due_today" | "due_this_week" | "due_this_month" | "upcoming" | "none";

export function getDueStatus(task: { due_date?: string | null; status: string }): DueStatus {
  if (!task.due_date) return "none";
  if (task.status === TaskStatus.completed || task.status === TaskStatus.cancelled) return "none";
  const due = new Date(task.due_date);
  const today = startOfDay(new Date());
  if (isBefore(startOfDay(due), today)) return "overdue";
  if (isToday(due)) return "due_today";
  if (isThisWeek(due, { weekStartsOn: 1 })) return "due_this_week";
  if (isThisMonth(due)) return "due_this_month";
  return "upcoming";
}

export interface TaskAccessUser {
  email: string;
  role: string;
}

export function canUserAccessTask(
  user: TaskAccessUser,
  task: { created_by: string; assigned_to?: string | null }
): boolean {
  if (user.role === "admin") return true;
  return task.created_by === user.email || task.assigned_to === user.email;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "N/A";
  try {
    return format(new Date(d), "MMM d, yyyy");
  } catch (e) {
    return "Invalid Date";
  }
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "N/A";
  try {
    return format(new Date(d), "MMM d, yyyy h:mm a");
  } catch (e) {
    return "Invalid Date";
  }
}

export function isOverdue(task: { due_date?: string | null; status: string }): boolean {
  return getDueStatus(task) === "overdue";
}

export function isDueToday(task: { due_date?: string | null; status: string }): boolean {
  return getDueStatus(task) === "due_today";
}

export function isDueThisWeek(task: { due_date?: string | null; status: string }): boolean {
  const s = getDueStatus(task);
  return s === "due_this_week" || s === "due_today";
}

export function isDueThisMonth(task: { due_date?: string | null; status: string }): boolean {
  const s = getDueStatus(task);
  return s === "due_this_month" || s === "due_this_week" || s === "due_today";
}
