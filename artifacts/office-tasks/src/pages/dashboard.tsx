import { useMemo } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useGetTasksByStatus,
  getGetTasksByStatusQueryKey,
  useGetTasksByPriority,
  getGetTasksByPriorityQueryKey,
  useGetDueTodayTasks,
  getGetDueTodayTasksQueryKey,
  useGetOverdueTasks,
  getGetOverdueTasksQueryKey,
  useGetUpcomingTasks,
  getGetUpcomingTasksQueryKey,
  Task,
} from "@workspace/api-client-react";
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDate, isOverdue } from "@/lib/taskUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckSquare, AlertCircle, Clock, CalendarDays, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

function TaskListCard({ title, tasks, emptyText, icon: Icon, type }: { title: string; tasks?: Task[]; emptyText: string; icon: any; type: "overdue" | "today" | "upcoming" }) {
  return (
    <Card className="col-span-1 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col">
        {!tasks ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <CheckSquare className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">{emptyText}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50 flex-1 overflow-auto">
            {tasks.map(task => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="block hover:bg-muted/50 p-4 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium line-clamp-1">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(task.due_date)}
                      </span>
                      {task.assigned_to_name && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 rounded">
                          {task.assigned_to_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={PRIORITY_CONFIG[task.priority]?.color}>
                    {PRIORITY_CONFIG[task.priority]?.label}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="p-3 border-t border-border/50 mt-auto bg-muted/20">
          <Link href={`/tasks`} className="text-xs font-medium flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            View all {title.toLowerCase()} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: statusData } = useGetTasksByStatus({ query: { queryKey: getGetTasksByStatusQueryKey() } });
  const { data: priorityData } = useGetTasksByPriority({ query: { queryKey: getGetTasksByPriorityQueryKey() } });
  
  const { data: dueTodayTasks } = useGetDueTodayTasks({ query: { queryKey: getGetDueTodayTasksQueryKey() } });
  const { data: overdueTasks } = useGetOverdueTasks({ query: { queryKey: getGetOverdueTasksQueryKey() } });
  const { data: upcomingTasks } = useGetUpcomingTasks({ query: { queryKey: getGetUpcomingTasksQueryKey() } });

  const statusChartData = useMemo(() => {
    if (!statusData) return [];
    return statusData.map(item => ({
      name: STATUS_CONFIG[item.status]?.label || item.status,
      count: item.count,
    }));
  }, [statusData]);

  const priorityChartData = useMemo(() => {
    if (!priorityData) return [];
    const colors = {
      low: "hsl(var(--muted-foreground))",
      medium: "hsl(var(--primary))",
      high: "hsl(var(--chart-3))",
      urgent: "hsl(var(--destructive))",
    };
    return priorityData.map(item => ({
      name: PRIORITY_CONFIG[item.priority]?.label || item.priority,
      value: item.count,
      color: colors[item.priority as keyof typeof colors] || "hsl(var(--primary))",
    }));
  }, [priorityData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Welcome to your task overview.</p>
        </div>
        <Link href="/tasks/new">
          <Button>Create Task</Button>
        </Link>
      </div>

      {isLoadingSummary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.total_tasks || 0}</div>
              <p className="text-xs text-muted-foreground">{summary?.completed_this_week || 0} completed this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary?.overdue || 0}</div>
              <p className="text-xs text-muted-foreground">Action required</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Due Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.due_today || 0}</div>
              <p className="text-xs text-muted-foreground">Needs attention today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.high_priority || 0}</div>
              <p className="text-xs text-muted-foreground">Important tasks pending</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[250px] w-full">
              {statusData && statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={String} />
                    <RechartsTooltip 
                      cursor={{ fill: 'hsl(var(--muted))' }} 
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {priorityData && priorityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {priorityChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TaskListCard 
          title="Overdue" 
          tasks={overdueTasks} 
          emptyText="No overdue tasks" 
          icon={AlertCircle}
          type="overdue"
        />
        <TaskListCard 
          title="Due Today" 
          tasks={dueTodayTasks} 
          emptyText="No tasks due today" 
          icon={Clock}
          type="today"
        />
        <TaskListCard 
          title="Upcoming" 
          tasks={upcomingTasks} 
          emptyText="No upcoming tasks" 
          icon={CalendarDays}
          type="upcoming"
        />
      </div>
    </div>
  );
}
