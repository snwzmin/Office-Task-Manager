import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import {
  useGetTask,
  getGetTaskQueryKey,
  useGetTaskComments,
  getGetTaskCommentsQueryKey,
  useGetTaskAttachments,
  getGetTaskAttachmentsQueryKey,
  useGetTaskActivity,
  getGetTaskActivityQueryKey,
  useChangeTaskStatus,
  useCreateTaskComment,
  useCreateTaskAttachment,
  useArchiveTask,
  useDeleteTask,
  TaskStatus,
  type TaskComment,
  type TaskAttachment,
  type TaskActivityLog,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate, formatDateTime, isOverdue } from "@/lib/taskUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FolderOpen,
  MessageSquare,
  Paperclip,
  Activity,
  Archive,
  Trash2,
  Edit,
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  Image,
} from "lucide-react";

const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png";

function getFileIcon(fileName: string) {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
    return <Image className="h-5 w-5 text-blue-500" />;
  if (["doc", "docx"].includes(ext))
    return <FileText className="h-5 w-5 text-blue-700" />;
  if (["xls", "xlsx"].includes(ext))
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (["ppt", "pptx"].includes(ext))
    return <Presentation className="h-5 w-5 text-orange-500" />;
  if (ext === "pdf")
    return <File className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export default function TaskDetail({ taskId }: { taskId: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const attachFileRef = useRef<HTMLInputElement>(null);

  const { data: task, isLoading: isTaskLoading } = useGetTask(taskId, {
    query: { queryKey: getGetTaskQueryKey(taskId) }
  });

  const { data: comments, isLoading: isCommentsLoading } = useGetTaskComments(taskId, {
    query: { queryKey: getGetTaskCommentsQueryKey(taskId) }
  });

  const { data: attachments, isLoading: isAttachmentsLoading } = useGetTaskAttachments(taskId, {
    query: { queryKey: getGetTaskAttachmentsQueryKey(taskId) }
  });

  const { data: activity, isLoading: isActivityLoading } = useGetTaskActivity(taskId, {
    query: { queryKey: getGetTaskActivityQueryKey(taskId) }
  });

  const statusMutation = useChangeTaskStatus();
  const commentMutation = useCreateTaskComment();
  const attachmentMutation = useCreateTaskAttachment();
  const archiveMutation = useArchiveTask();
  const deleteMutation = useDeleteTask();

  if (isTaskLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!task) {
    return <div>Task not found</div>;
  }

  const handleStatusChange = (newStatus: TaskStatus) => {
    statusMutation.mutate(
      { id: taskId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
          queryClient.invalidateQueries({ queryKey: getGetTaskActivityQueryKey(taskId) });
          toast({ title: "Status updated" });
        },
        onError: () => toast({ title: "Failed to update status", variant: "destructive" })
      }
    );
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    commentMutation.mutate(
      { id: taskId, data: { comment_text: commentText } },
      {
        onSuccess: () => {
          setCommentText("");
          queryClient.invalidateQueries({ queryKey: getGetTaskCommentsQueryKey(taskId) });
          queryClient.invalidateQueries({ queryKey: getGetTaskActivityQueryKey(taskId) });
          toast({ title: "Comment added" });
        },
        onError: () => toast({ title: "Failed to add comment", variant: "destructive" })
      }
    );
  };

  const handleArchive = () => {
    archiveMutation.mutate(
      { id: taskId, data: { is_archived: !task.is_archived } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
          toast({ title: task.is_archived ? "Task restored" : "Task archived" });
        },
        onError: () => toast({ title: "Failed to archive task", variant: "destructive" })
      }
    );
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    deleteMutation.mutate(
      { id: taskId },
      {
        onSuccess: () => {
          toast({ title: "Task deleted" });
          setLocation("/tasks");
        },
        onError: () => toast({ title: "Failed to delete task", variant: "destructive" })
      }
    );
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File exceeds 20 MB limit", variant: "destructive" });
      return;
    }

    setIsUploadingFile(true);
    try {
      const token = localStorage.getItem("auth_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? "Upload failed");
      }

      const uploaded = await res.json() as {
        file_name: string;
        file_url: string;
        file_type: string;
        file_size: string;
      };

      attachmentMutation.mutate(
        {
          id: taskId,
          data: {
            file_name: uploaded.file_name,
            file_url: uploaded.file_url,
            file_type: uploaded.file_type,
            file_size: uploaded.file_size,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetTaskAttachmentsQueryKey(taskId) });
            queryClient.invalidateQueries({ queryKey: getGetTaskActivityQueryKey(taskId) });
            toast({ title: `"${file.name}" attached successfully` });
          },
          onError: () => toast({ title: "Failed to save attachment record", variant: "destructive" }),
        }
      );
    } catch (err) {
      toast({ title: `Upload failed: ${(err as Error).message}`, variant: "destructive" });
    } finally {
      setIsUploadingFile(false);
      if (attachFileRef.current) attachFileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/tasks")} data-testid="btn-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            {task.title}
            {task.is_archived && <Badge variant="secondary">Archived</Badge>}
          </h1>
          {task.reference_number && (
            <p className="text-xs text-muted-foreground mt-0.5">Ref: {task.reference_number}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/tasks/${taskId}/edit`}>
            <Button variant="outline" size="sm" data-testid="btn-edit-task">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleArchive} data-testid="btn-archive-task">
            <Archive className="h-4 w-4 mr-2" />
            {task.is_archived ? "Restore" : "Archive"}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} data-testid="btn-delete-task">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm text-foreground/90">
                {task.description || <span className="text-muted-foreground italic">No description provided.</span>}
              </div>

              {task.tags && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {task.tags.split(",").map((tag: string) => (
                    <Badge key={tag.trim()} variant="secondary" className="text-xs">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="comments" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="comments" className="text-xs sm:text-sm" data-testid="tab-comments">
                <MessageSquare className="h-3 w-3 mr-2" /> Comments
              </TabsTrigger>
              <TabsTrigger value="attachments" className="text-xs sm:text-sm" data-testid="tab-attachments">
                <Paperclip className="h-3 w-3 mr-2" />
                Attachments
                {(attachments?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{attachments!.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs sm:text-sm" data-testid="tab-activity">
                <Activity className="h-3 w-3 mr-2" /> Activity
              </TabsTrigger>
            </TabsList>

            {/* Comments */}
            <TabsContent value="comments" className="mt-4 space-y-4">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <Textarea
                    placeholder="Add a comment…"
                    className="resize-none"
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    data-testid="input-comment"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || commentMutation.isPending}
                      data-testid="btn-submit-comment"
                    >
                      Post Comment
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {isCommentsLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : comments?.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">No comments yet.</div>
                ) : (
                  comments?.map((comment: TaskComment) => (
                    <div key={comment.id} className="flex gap-4 p-4 border rounded-lg bg-card">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{comment.user_name?.charAt(0) ?? "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{comment.user_name}</p>
                          <span className="text-xs text-muted-foreground">{formatDateTime(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-foreground/80">{comment.comment_text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Attachments */}
            <TabsContent value="attachments" className="mt-4">
              <Card>
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Files &amp; Documents
                  </CardTitle>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => attachFileRef.current?.click()}
                      disabled={isUploadingFile}
                      data-testid="btn-attach-file"
                    >
                      {isUploadingFile ? (
                        <span className="flex items-center gap-1">
                          <Upload className="h-4 w-4 animate-pulse" /> Uploading…
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Paperclip className="h-4 w-4" /> Attach File
                        </span>
                      )}
                    </Button>
                    <input
                      ref={attachFileRef}
                      type="file"
                      accept={ACCEPTED_FILE_TYPES}
                      onChange={handleFileAttach}
                      className="hidden"
                      data-testid="input-attach-file"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isAttachmentsLoading ? (
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : !attachments || attachments.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No attachments yet.</p>
                      <p className="text-xs mt-1">Attach PDF, Word, Excel, PowerPoint, or image files.</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {attachments.map((att: TaskAttachment) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                        >
                          <div className="shrink-0">{getFileIcon(att.file_name)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{att.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {att.file_size && `${att.file_size} · `}
                              Uploaded by {att.uploaded_by_name} · {formatDateTime(att.created_at)}
                            </p>
                          </div>
                          <a
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={att.file_name}
                            data-testid={`btn-download-${att.id}`}
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activity */}
            <TabsContent value="activity" className="mt-4">
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {isActivityLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : activity?.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">No activity recorded.</div>
                ) : (
                  activity?.map((log: TaskActivityLog) => (
                    <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-300">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] border rounded-lg p-4 bg-card shadow-sm">
                        <div className="flex items-center justify-between space-x-2 mb-1">
                          <div className="font-medium text-sm">{log.user_name}</div>
                          <time className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</time>
                        </div>
                        <div className="text-sm text-foreground/80">
                          {log.action_type.replace(/_/g, " ")}
                          {log.action_details && (
                            <span className="ml-1 opacity-70">({log.action_details})</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-medium">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-sm">
                <div className="p-4 flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={STATUS_CONFIG[task.status]?.color}>
                    {STATUS_CONFIG[task.status]?.label ?? task.status}
                  </Badge>
                </div>
                <div className="p-4 flex justify-between items-center">
                  <span className="text-muted-foreground">Priority</span>
                  <Badge variant="outline" className={PRIORITY_CONFIG[task.priority]?.color}>
                    {PRIORITY_CONFIG[task.priority]?.label ?? task.priority}
                  </Badge>
                </div>
                <div className="p-4 flex justify-between items-center">
                  <span className="text-muted-foreground">Assignee</span>
                  <span className="font-medium">{task.assigned_to_name ?? "Unassigned"}</span>
                </div>
                {task.source_department && (
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-muted-foreground">Source Dept.</span>
                    <span className="font-medium">{task.source_department}</span>
                  </div>
                )}
                {task.start_date && (
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Start Date
                    </span>
                    <span className="font-medium">{formatDate(task.start_date)}</span>
                  </div>
                )}
                <div className="p-4 flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Due Date
                  </span>
                  <span className={`font-medium ${isOverdue(task) ? "text-destructive" : ""}`}>
                    {formatDate(task.due_date)}
                    {task.due_time && ` ${task.due_time}`}
                  </span>
                </div>
                <div className="p-4 flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Created
                  </span>
                  <span className="font-medium">{formatDate(task.created_at)}</span>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <span className="text-muted-foreground">Created By</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{task.created_by_name?.charAt(0) ?? "U"}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{task.created_by_name}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-medium">Update Status</CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-2 gap-2">
              {Object.entries(TaskStatus).map(([key, value]) => (
                <Button
                  key={key}
                  variant={task.status === value ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handleStatusChange(value as TaskStatus)}
                  disabled={task.status === value || statusMutation.isPending}
                  data-testid={`btn-status-${value}`}
                >
                  {STATUS_CONFIG[value]?.label ?? value}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
