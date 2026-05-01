import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetTask,
  getGetTaskQueryKey,
  getGetTasksQueryKey,
  useCreateTask,
  useUpdateTask,
  useGetCategories,
  getGetCategoriesQueryKey,
  useGetActiveUsers,
  getGetActiveUsersQueryKey,
  useGetMe,
  getGetMeQueryKey,
  useCreateTaskAttachment,
  getGetTaskAttachmentsQueryKey,
  TaskStatus,
  TaskPriority,
  ReminderOption,
  type Category,
  type UserDirectory,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/taskUtils";
import { ArrowLeft, Save, Paperclip, X, FileText, FileSpreadsheet, Presentation, File, Image } from "lucide-react";

const REMINDER_LABELS: Record<string, string> = {
  none: "No reminder",
  on_due: "At due time",
  "15min_before": "15 minutes before",
  "1hr_before": "1 hour before",
  "2hr_before": "2 hours before",
  "1day_before": "1 day before",
  custom: "Custom date/time",
};

const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png";
const MAX_FILE_SIZE_MB = 20;

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
    return <Image className="h-4 w-4 text-blue-500" />;
  if (["doc", "docx"].includes(ext))
    return <FileText className="h-4 w-4 text-blue-700" />;
  if (["xls", "xlsx"].includes(ext))
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (["ppt", "pptx"].includes(ext))
    return <Presentation className="h-4 w-4 text-orange-500" />;
  if (ext === "pdf")
    return <File className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  reference_number: z.string().optional(),
  source_department: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "waiting_for_response", "deferred", "completed", "cancelled"]).default("not_started"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  category_id: z.string().optional(),
  assigned_to: z.string().optional(),
  start_date: z.string().optional(),
  due_date: z.string().min(1, "Due date is required"),
  due_time: z.string().optional(),
  reminder_option: z.enum(["none", "on_due", "15min_before", "1hr_before", "2hr_before", "1day_before", "custom"]).default("none"),
  custom_reminder_datetime: z.string().optional(),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function TaskForm({ taskId }: { taskId?: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!taskId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { data: currentUser } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: categories } = useGetCategories(undefined, { query: { queryKey: getGetCategoriesQueryKey() } });
  const { data: users } = useGetActiveUsers({ query: { queryKey: getGetActiveUsersQueryKey() } });

  const { data: task, isLoading: isTaskLoading } = useGetTask(taskId as string, {
    query: {
      queryKey: getGetTaskQueryKey(taskId as string),
      enabled: isEditMode,
    }
  });

  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const attachmentMutation = useCreateTaskAttachment();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      reference_number: "",
      source_department: "",
      status: "not_started",
      priority: "medium",
      category_id: "",
      assigned_to: "",
      start_date: "",
      due_date: new Date().toISOString().split("T")[0],
      due_time: "",
      reminder_option: "none",
      custom_reminder_datetime: "",
      tags: "",
    },
  });

  const reminderOption = form.watch("reminder_option");

  useEffect(() => {
    if (isEditMode && task) {
      form.reset({
        title: task.title,
        description: task.description ?? "",
        reference_number: task.reference_number ?? "",
        source_department: task.source_department ?? "",
        status: task.status,
        priority: task.priority,
        category_id: task.category_id ?? "none",
        assigned_to: task.assigned_to ?? "none",
        start_date: task.start_date ?? "",
        due_date: task.due_date ? task.due_date.slice(0, 10) : "",
        due_time: task.due_time ?? "",
        reminder_option: (task.reminder_option as FormValues["reminder_option"]) ?? "none",
        custom_reminder_datetime: task.custom_reminder_datetime ?? "",
        tags: task.tags ?? "",
      });
    }
  }, [task, isEditMode, form]);

  async function uploadFilesForTask(newTaskId: string) {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    const token = localStorage.getItem("auth_token");
    const results: string[] = [];
    const errors: string[] = [];

    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token ?? ""}` },
          body: formData,
        });
        if (!res.ok) throw new Error(await res.text());
        const uploaded = await res.json() as { file_name: string; file_url: string; file_type: string; file_size: string };
        await new Promise<void>((resolve, reject) => {
          attachmentMutation.mutate(
            {
              id: newTaskId,
              data: {
                file_name: uploaded.file_name,
                file_url: uploaded.file_url,
                file_type: uploaded.file_type,
                file_size: uploaded.file_size,
              },
            },
            { onSuccess: () => resolve(), onError: (e) => reject(e) }
          );
        });
        results.push(file.name);
      } catch {
        errors.push(file.name);
      }
    }

    if (results.length > 0) {
      queryClient.invalidateQueries({ queryKey: getGetTaskAttachmentsQueryKey(newTaskId) });
    }
    if (errors.length > 0) {
      toast({ title: `Failed to upload: ${errors.join(", ")}`, variant: "destructive" });
    }
    setIsUploading(false);
  }

  const onSubmit = (values: FormValues) => {
    if (!currentUser) {
      toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
      return;
    }

    const assigned_to = !values.assigned_to || values.assigned_to === "none" ? undefined : values.assigned_to;
    const category_id = !values.category_id || values.category_id === "none" ? undefined : values.category_id;

    let assigned_to_name: string | undefined;
    if (assigned_to && users) {
      const found = users.find((u: UserDirectory) => u.email === assigned_to);
      if (found) assigned_to_name = found.name;
    }

    const payload = {
      ...values,
      assigned_to,
      assigned_to_name,
      category_id,
      reference_number: values.reference_number || undefined,
      source_department: values.source_department || undefined,
      start_date: values.start_date || undefined,
      due_time: values.due_time || undefined,
      custom_reminder_datetime: values.reminder_option === "custom" ? values.custom_reminder_datetime || undefined : undefined,
      tags: values.tags || undefined,
    };

    if (isEditMode) {
      updateMutation.mutate(
        { id: taskId as string, data: payload },
        {
          onSuccess: async (data) => {
            queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId as string) });
            await uploadFilesForTask(data.id);
            toast({ title: "Task updated successfully" });
            setLocation(`/tasks/${data.id}`);
          },
          onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: async (data) => {
            queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
            await uploadFilesForTask(data.id);
            toast({ title: "Task created successfully" });
            setLocation(`/tasks/${data.id}`);
          },
          onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
        }
      );
    }
  };

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    const oversized: string[] = [];
    for (const f of newFiles) {
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        oversized.push(f.name);
      } else {
        valid.push(f);
      }
    }
    if (oversized.length > 0) {
      toast({ title: `Files exceed 20 MB limit: ${oversized.join(", ")}`, variant: "destructive" });
    }
    setSelectedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(name: string) {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== name));
  }

  if (isEditMode && isTaskLoading) {
    return <div className="p-8 text-muted-foreground">Loading task data…</div>;
  }

  const isPending = createMutation.isPending || updateMutation.isPending || isUploading;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="btn-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditMode ? "Edit Task" : "Create New Task"}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Update the details for this task." : "Fill out the details to create a new task."}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Task title" {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reference number + Source department */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="reference_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. REF-2024-001" {...field} data-testid="input-reference" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="source_department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Department</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Finance" {...field} data-testid="input-source-dept" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TaskStatus).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              {STATUS_CONFIG[value]?.label ?? value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TaskPriority).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              {PRIORITY_CONFIG[value]?.label ?? value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Category + Assignee */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Category</SelectItem>
                          {categories?.map((c: Category) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assignee</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-assignee">
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {users?.map((u: UserDirectory) => (
                            <SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-due-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="due_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-due-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Reminder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="reminder_option"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reminder</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-reminder">
                            <SelectValue placeholder="Select reminder" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(ReminderOption).map((v) => (
                            <SelectItem key={v} value={v}>
                              {REMINDER_LABELS[v] ?? v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {reminderOption === "custom" && (
                  <FormField
                    control={form.control}
                    name="custom_reminder_datetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Reminder Date &amp; Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-custom-reminder" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Tags */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="marketing, urgent, review (comma-separated)" {...field} data-testid="input-tags" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed description of the task…"
                        className="min-h-[120px] resize-y"
                        {...field}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* File Attachments */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Attachments</p>
                    <p className="text-xs text-muted-foreground">
                      PDF, Word, Excel, PowerPoint, JPEG, PNG — max 20 MB each
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="btn-add-attachment"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="input-file"
                  />
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    {selectedFiles.map((f) => (
                      <div key={f.name} className="flex items-center gap-2 p-2 rounded-md border bg-muted/40">
                        {getFileIcon(f.name)}
                        <span className="text-sm flex-1 truncate">{f.name}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {(f.size / 1024).toFixed(1)} KB
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removeFile(f.name)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.history.back()}
                  data-testid="btn-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="btn-submit-task"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isPending
                    ? isUploading ? "Uploading files…" : "Saving…"
                    : isEditMode ? "Save Changes" : "Create Task"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
