import { useState } from "react";
import {
  useGetReportsSummary,
  getGetReportsSummaryQueryKey
} from "@workspace/api-client-react";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/taskUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, Calendar as CalendarIcon, CheckSquare, AlertCircle, BarChart3 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, CartesianGrid
} from "recharts";

export default function Reports() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const queryParams = {
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {})
  };

  const { data: summary, isLoading } = useGetReportsSummary(queryParams, {
    query: { queryKey: getGetReportsSummaryQueryKey(queryParams) }
  });

  const exportCSV = () => {
    if (!summary) return;
    
    const lines: string[] = [
      "Report Summary",
      "",
      "Overall",
      `Total Tasks,${summary.total}`,
      `Completed,${summary.completed}`,
      `Overdue,${summary.overdue}`,
      "",
      "By Status",
      "Status,Count",
      ...summary.by_status.map(item => `"${STATUS_CONFIG[item.status]?.label || item.status}",${item.count}`),
      "",
      "By Priority",
      "Priority,Count",
      ...summary.by_priority.map(item => `"${PRIORITY_CONFIG[item.priority]?.label || item.priority}",${item.count}`),
      "",
      "By User",
      "User,Count",
      ...summary.by_user.map(item => `"${item.user_name}",${item.count}`),
    ];
    const csvContent = lines.join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "task_reports.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (!summary) return;
    const doc = new jsPDF();
    const exportDate = new Date().toLocaleDateString();

    doc.setFontSize(18);
    doc.text("Task Reports & Analytics", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Exported ${exportDate}`, 14, 27);

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text("Overall Summary", 14, 38);
    autoTable(doc, {
      startY: 42,
      head: [["Metric", "Value"]],
      body: [
        ["Total Tasks", String(summary.total)],
        ["Completed", String(summary.completed)],
        ["Overdue", String(summary.overdue)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const afterOverall = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.text("By Status", 14, afterOverall);
    autoTable(doc, {
      startY: afterOverall + 4,
      head: [["Status", "Count"]],
      body: summary.by_status.map((item) => [
        STATUS_CONFIG[item.status]?.label ?? item.status,
        String(item.count),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const afterStatus = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.text("By Priority", 14, afterStatus);
    autoTable(doc, {
      startY: afterStatus + 4,
      head: [["Priority", "Count"]],
      body: summary.by_priority.map((item) => [
        PRIORITY_CONFIG[item.priority]?.label ?? item.priority,
        String(item.count),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const afterPriority = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.text("By User", 14, afterPriority);
    autoTable(doc, {
      startY: afterPriority + 4,
      head: [["User", "Task Count"]],
      body: summary.by_user.map((item) => [item.user_name, String(item.count)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save("task_reports.pdf");
  };

  const priorityColors = {
    low: "hsl(var(--muted-foreground))",
    medium: "hsl(var(--primary))",
    high: "hsl(var(--chart-3))",
    urgent: "hsl(var(--destructive))",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-muted-foreground">Detailed insights into task performance and distribution.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={!summary || isLoading} data-testid="btn-export-reports">
              <FileDown className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportCSV} className="cursor-pointer" data-testid="btn-export-reports-csv">
              <FileDown className="mr-2 h-4 w-4" /> Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPDF} className="cursor-pointer" data-testid="btn-export-reports-pdf">
              <FileDown className="mr-2 h-4 w-4" /> Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Date Range:</span>
            </div>
            <div className="flex items-center gap-2">
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-auto text-sm"
                data-testid="input-date-from"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                className="w-auto text-sm"
                data-testid="input-date-to"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-[350px] w-full rounded-xl md:col-span-2" />
          <Skeleton className="h-[350px] w-full rounded-xl md:col-span-1" />
          <Skeleton className="h-[350px] w-full rounded-xl md:col-span-3" />
        </div>
      ) : summary ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                  <p className="text-3xl font-bold mt-1">{summary.total}</p>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <BarChart3 className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold mt-1">{summary.completed}</p>
                </div>
                <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-600">
                  <CheckSquare className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <p className="text-3xl font-bold mt-1 text-destructive">{summary.overdue}</p>
                </div>
                <div className="h-12 w-12 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
                  <AlertCircle className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Tasks by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.by_status.map(s => ({ name: STATUS_CONFIG[s.status]?.label || s.status, count: s.count }))} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Priority Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.by_priority.map(p => ({ name: PRIORITY_CONFIG[p.priority]?.label || p.priority, value: p.count, color: priorityColors[p.priority as keyof typeof priorityColors] || "hsl(var(--primary))" }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {summary.by_priority.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={priorityColors[entry.priority as keyof typeof priorityColors] || "hsl(var(--primary))"} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks Assigned by User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                {summary.by_user.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.by_user} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="user_name" type="category" fontSize={12} tickLine={false} axisLine={false} width={100} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No user assignments found.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">Failed to load reports data.</div>
      )}
    </div>
  );
}
