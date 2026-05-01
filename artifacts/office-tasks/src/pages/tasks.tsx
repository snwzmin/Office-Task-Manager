import { useState } from "react";
import { Link } from "wouter";
import {
  useGetTasks,
  getGetTasksQueryKey,
  useGetCategories,
  getGetCategoriesQueryKey,
  useDeleteTask,
  useArchiveTask,
  useDuplicateTask,
  useGetMe,
  getGetMeQueryKey,
  TaskStatus,
  TaskPriority,
  type Task,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate, isOverdue } from "@/lib/taskUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreHorizontal, FileDown, Eye, Edit, Trash2, Archive, ArchiveRestore, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Tasks() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [isArchived, setIsArchived] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: currentUser } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const isAdmin = currentUser?.role === "admin";

  const { data: categories } = useGetCategories(undefined, { query: { queryKey: getGetCategoriesQueryKey() } });

  const queryParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status !== "all" ? { status: status as TaskStatus } : {}),
    ...(priority !== "all" ? { priority: priority as TaskPriority } : {}),
    ...(categoryId !== "all" ? { category_id: categoryId } : {}),
    is_archived: isArchived
  };

  const { data: tasksData, isLoading } = useGetTasks(queryParams, { query: { queryKey: getGetTasksQueryKey(queryParams) } });
  const tasks: Task[] = tasksData ?? [];

  const archiveMutation = useArchiveTask();
  const deleteMutation = useDeleteTask();
  const duplicateMutation = useDuplicateTask();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setDebouncedSearch(e.target.value);
  };

  const handleArchive = (id: string, currentlyArchived: boolean) => {
    archiveMutation.mutate(
      { id, data: { is_archived: !currentlyArchived } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
          toast({ title: currentlyArchived ? "Task restored" : "Task archived" });
        },
        onError: () => toast({ title: "Failed to update task", variant: "destructive" })
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
          toast({ title: "Task deleted" });
        },
        onError: () => toast({ title: "Failed to delete task", variant: "destructive" })
      }
    );
  };

  const exportCSV = () => {
    if (!tasks.length) return;
    const headers = ["Title", "Status", "Priority", "Assigned To", "Due Date"];
    const csvContent = [
      headers.join(","),
      ...tasks.map((t) => [
        `"${t.title.replace(/"/g, '""')}"`,
        t.status,
        t.priority,
        `"${t.assigned_to_name || ''}"`,
        t.due_date
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "tasks.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground">Manage and track all office tasks.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={!tasks.length} data-testid="btn-export">
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/tasks/new">
            <Button data-testid="btn-create-task">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                className="pl-8"
                value={search}
                onChange={handleSearchChange}
                data-testid="input-search"
              />
            </div>
            
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(TaskStatus).map(([key, value]) => (
                    <SelectItem key={key} value={value}>{STATUS_CONFIG[value]?.label || value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  {Object.entries(TaskPriority).map(([key, value]) => (
                    <SelectItem key={key} value={value}>{PRIORITY_CONFIG[value]?.label || value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2 shrink-0 whitespace-nowrap">
              <Checkbox id="archived" checked={isArchived} onCheckedChange={(checked) => setIsArchived(checked === true)} />
              <label htmlFor="archived" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Show archived
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                </TableRow>
              ))
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No tasks found.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">
                    <Link href={`/tasks/${task.id}`} className="hover:underline">
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_CONFIG[task.status]?.color}>
                      {STATUS_CONFIG[task.status]?.label || task.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PRIORITY_CONFIG[task.priority]?.color}>
                      {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{task.assigned_to_name || "Unassigned"}</TableCell>
                  <TableCell>
                    <span className={isOverdue(task) ? "text-destructive font-medium" : ""}>
                      {formatDate(task.due_date)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <Link href={`/tasks/${task.id}`}>
                          <DropdownMenuItem className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                        </Link>
                        <Link href={`/tasks/${task.id}/edit`}>
                          <DropdownMenuItem className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" /> Edit Task
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleArchive(task.id, task.is_archived)} className="cursor-pointer">
                          {task.is_archived ? (
                            <><ArchiveRestore className="mr-2 h-4 w-4" /> Restore</>
                          ) : (
                            <><Archive className="mr-2 h-4 w-4" /> Archive</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(task.id)} className="cursor-pointer text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
