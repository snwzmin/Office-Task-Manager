import { useEffect } from "react";
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
  useGetUsers,
  getGetUsersQueryKey,
  useGetMe,
  getGetMeQueryKey,
  TaskStatus,
  TaskPriority
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/taskUtils";
import { ArrowLeft, Save } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "waiting_for_response", "deferred", "completed", "cancelled"]).default("not_started"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  category_id: z.string().optional(),
  assigned_to: z.string().optional(),
  due_date: z.string().min(1, "Due date is required"),
  tags: z.string().optional(),
});

export default function TaskForm({ taskId }: { taskId?: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!taskId;

  const { data: currentUser } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: categories } = useGetCategories(undefined, { query: { queryKey: getGetCategoriesQueryKey() } });
  const { data: users } = useGetUsers({ query: { queryKey: getGetUsersQueryKey() } });

  const { data: task, isLoading: isTaskLoading } = useGetTask(taskId as string, {
    query: { 
      queryKey: getGetTaskQueryKey(taskId as string),
      enabled: isEditMode
    }
  });

  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "not_started" as const,
      priority: "medium" as const,
      category_id: "",
      assigned_to: "",
      due_date: new Date().toISOString().split('T')[0],
      tags: "",
    },
  });

  useEffect(() => {
    if (isEditMode && task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        category_id: task.category_id || "none",
        assigned_to: task.assigned_to || "none",
        due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : "",
        tags: task.tags || "",
      });
    }
  }, [task, isEditMode, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!currentUser) {
      toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
      return;
    }

    const assigned_to = values.assigned_to === "none" ? undefined : values.assigned_to;
    const category_id = values.category_id === "none" ? undefined : values.category_id;
    
    let assigned_to_name = undefined;
    if (assigned_to && users) {
      const user = users.find((u: any) => u.email === assigned_to || u.id === assigned_to);
      if (user) assigned_to_name = user.name;
    }

    if (isEditMode) {
      updateMutation.mutate(
        {
          id: taskId as string,
          data: {
            ...values,
            assigned_to,
            assigned_to_name,
            category_id,
          }
        },
        {
          onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId as string) });
            toast({ title: "Task updated successfully" });
            setLocation(`/tasks/${data.id}`);
          },
          onError: () => toast({ title: "Failed to update task", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        {
          data: {
            ...values,
            assigned_to,
            assigned_to_name,
            category_id,
          }
        },
        {
          onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
            toast({ title: "Task created successfully" });
            setLocation(`/tasks/${data.id}`);
          },
          onError: () => toast({ title: "Failed to create task", variant: "destructive" })
        }
      );
    }
  };

  if (isEditMode && isTaskLoading) {
    return <div>Loading task data...</div>;
  }

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
                              {STATUS_CONFIG[value]?.label || value}
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
                              {PRIORITY_CONFIG[value]?.label || value}
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
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assignee</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-assignee">
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {users?.map((u: any) => (
                            <SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Category</SelectItem>
                          {categories?.map((c: any) => (
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
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input placeholder="marketing, urgent, review (comma separated)" {...field} data-testid="input-tags" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Detailed description of the task..." 
                        className="min-h-[120px] resize-y" 
                        {...field} 
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="btn-submit-task"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isEditMode ? "Save Changes" : "Create Task"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
