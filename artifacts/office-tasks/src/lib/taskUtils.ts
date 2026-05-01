import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { TaskStatus, TaskPriority } from "@workspace/api-client-react";

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
  if (!task.due_date) return false;
  if (task.status === TaskStatus.completed || task.status === TaskStatus.cancelled) return false;
  return isBefore(startOfDay(new Date(task.due_date)), startOfDay(new Date()));
}

export function isDueToday(task: { due_date?: string | null }): boolean {
  if (!task.due_date) return false;
  return isToday(new Date(task.due_date));
}
