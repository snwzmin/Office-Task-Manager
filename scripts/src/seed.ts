import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  categoriesTable,
  tasksTable,
  taskActivityLogsTable,
} from "@workspace/db/schema";
import { randomUUID } from "crypto";

async function seed() {
  console.log("Seeding database...");

  // Users
  const adminHash = await bcrypt.hash("admin123", 10);
  const userHash = await bcrypt.hash("user123", 10);

  const adminId = randomUUID();
  const userId1 = randomUUID();
  const userId2 = randomUUID();

  await db
    .insert(usersTable)
    .values([
      {
        id: adminId,
        email: "admin@office.com",
        name: "Admin User",
        password_hash: adminHash,
        role: "admin",
        department: "Management",
        is_active: true,
      },
      {
        id: userId1,
        email: "alice@office.com",
        name: "Alice Johnson",
        password_hash: userHash,
        role: "user",
        department: "Operations",
        is_active: true,
      },
      {
        id: userId2,
        email: "bob@office.com",
        name: "Bob Smith",
        password_hash: userHash,
        role: "user",
        department: "Finance",
        is_active: true,
      },
    ])
    .onConflictDoNothing();

  console.log("✓ Users seeded");

  // Categories
  const categories = [
    { id: randomUUID(), name: "Administration", color: "#2563eb", description: "Administrative tasks" },
    { id: randomUUID(), name: "Finance", color: "#16a34a", description: "Finance and accounting" },
    { id: randomUUID(), name: "Operations", color: "#dc2626", description: "Day-to-day operations" },
    { id: randomUUID(), name: "HR", color: "#9333ea", description: "Human resources" },
    { id: randomUUID(), name: "IT", color: "#ea580c", description: "Information technology" },
  ];

  await db.insert(categoriesTable).values(categories).onConflictDoNothing();
  console.log("✓ Categories seeded");

  const catAdmin = categories[0];
  const catFinance = categories[1];
  const catOps = categories[2];
  const catHR = categories[3];
  const catIT = categories[4];

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const tasks = [
    {
      id: randomUUID(),
      title: "Prepare Q2 Budget Report",
      description: "Compile and review Q2 financial data for board presentation",
      category_id: catFinance.id,
      reference_number: "FIN-2024-001",
      source_department: "Finance",
      assigned_to: "alice@office.com",
      assigned_to_name: "Alice Johnson",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "high" as const,
      status: "in_progress" as const,
      start_date: lastWeek,
      due_date: tomorrow,
      reminder_option: "1day_before" as const,
      tags: "budget,finance,Q2",
    },
    {
      id: randomUUID(),
      title: "Staff Performance Reviews",
      description: "Complete annual performance reviews for all department staff",
      category_id: catHR.id,
      reference_number: "HR-2024-042",
      source_department: "HR",
      assigned_to: "admin@office.com",
      assigned_to_name: "Admin User",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "medium" as const,
      status: "not_started" as const,
      due_date: nextWeek,
      reminder_option: "1day_before" as const,
      tags: "hr,performance,annual",
    },
    {
      id: randomUUID(),
      title: "Update IT Security Policy",
      description: "Review and update company IT security policy document",
      category_id: catIT.id,
      reference_number: "IT-2024-017",
      source_department: "IT",
      assigned_to: "bob@office.com",
      assigned_to_name: "Bob Smith",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "urgent" as const,
      status: "waiting_for_response" as const,
      due_date: yesterday,
      reminder_option: "on_due" as const,
      tags: "security,policy,IT",
    },
    {
      id: randomUUID(),
      title: "Office Supplies Procurement",
      description: "Order office supplies for Q3",
      category_id: catAdmin.id,
      reference_number: "ADM-2024-088",
      source_department: "Administration",
      assigned_to: "alice@office.com",
      assigned_to_name: "Alice Johnson",
      created_by: "alice@office.com",
      created_by_name: "Alice Johnson",
      priority: "low" as const,
      status: "completed" as const,
      due_date: lastWeek,
      completed_at: lastWeek + "T10:00:00.000Z",
      reminder_option: "none" as const,
      tags: "admin,procurement",
    },
    {
      id: randomUUID(),
      title: "Server Infrastructure Upgrade",
      description: "Upgrade production servers to handle increased load",
      category_id: catIT.id,
      reference_number: "IT-2024-031",
      source_department: "IT",
      assigned_to: "bob@office.com",
      assigned_to_name: "Bob Smith",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "high" as const,
      status: "deferred" as const,
      due_date: twoWeeksAgo,
      reminder_option: "none" as const,
      tags: "IT,infrastructure,servers",
    },
    {
      id: randomUUID(),
      title: "Employee Onboarding Checklist",
      description: "Create standard onboarding checklist for new hires",
      category_id: catHR.id,
      reference_number: "HR-2024-055",
      source_department: "HR",
      assigned_to: "alice@office.com",
      assigned_to_name: "Alice Johnson",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "medium" as const,
      status: "in_progress" as const,
      due_date: nextWeek,
      reminder_option: "2hr_before" as const,
      tags: "hr,onboarding",
    },
    {
      id: randomUUID(),
      title: "Monthly Operations Report",
      description: "Compile monthly operations report for management",
      category_id: catOps.id,
      reference_number: "OPS-2024-012",
      source_department: "Operations",
      assigned_to: "alice@office.com",
      assigned_to_name: "Alice Johnson",
      created_by: "alice@office.com",
      created_by_name: "Alice Johnson",
      priority: "medium" as const,
      status: "completed" as const,
      due_date: lastWeek,
      completed_at: lastWeek + "T15:30:00.000Z",
      reminder_option: "1hr_before" as const,
      tags: "operations,report,monthly",
    },
    {
      id: randomUUID(),
      title: "Contract Renewal - Vendor A",
      description: "Renew annual service contract with primary vendor",
      category_id: catAdmin.id,
      reference_number: "ADM-2024-103",
      source_department: "Administration",
      assigned_to: "bob@office.com",
      assigned_to_name: "Bob Smith",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "urgent" as const,
      status: "not_started" as const,
      due_date: today,
      due_time: "17:00",
      reminder_option: "1hr_before" as const,
      tags: "admin,contract,vendor",
    },
    {
      id: randomUUID(),
      title: "Tax Filing Preparation",
      description: "Gather documents and prepare for quarterly tax filing",
      category_id: catFinance.id,
      reference_number: "FIN-2024-022",
      source_department: "Finance",
      assigned_to: "bob@office.com",
      assigned_to_name: "Bob Smith",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "high" as const,
      status: "in_progress" as const,
      due_date: nextWeek,
      reminder_option: "1day_before" as const,
      tags: "finance,tax,quarterly",
    },
    {
      id: randomUUID(),
      title: "Cybersecurity Training",
      description: "Organize mandatory cybersecurity training for all staff",
      category_id: catIT.id,
      reference_number: "IT-2024-055",
      source_department: "IT",
      assigned_to: "alice@office.com",
      assigned_to_name: "Alice Johnson",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "medium" as const,
      status: "not_started" as const,
      due_date: nextWeek,
      reminder_option: "1day_before" as const,
      tags: "security,training,IT",
    },
    {
      id: randomUUID(),
      title: "Office Renovation Planning",
      description: "Plan office renovation for Q4 - get quotes from contractors",
      category_id: catOps.id,
      reference_number: "OPS-2024-044",
      source_department: "Operations",
      assigned_to: "admin@office.com",
      assigned_to_name: "Admin User",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "low" as const,
      status: "deferred" as const,
      due_date: twoWeeksAgo,
      reminder_option: "none" as const,
      tags: "operations,renovation,Q4",
    },
    {
      id: randomUUID(),
      title: "Annual Audit Coordination",
      description: "Coordinate with external auditors for annual financial audit",
      category_id: catFinance.id,
      reference_number: "FIN-2024-055",
      source_department: "Finance",
      assigned_to: "alice@office.com",
      assigned_to_name: "Alice Johnson",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "urgent" as const,
      status: "waiting_for_response" as const,
      due_date: yesterday,
      reminder_option: "on_due" as const,
      tags: "finance,audit,annual",
    },
    {
      id: randomUUID(),
      title: "Update Employee Handbook",
      description: "Review and update company employee handbook with new policies",
      category_id: catHR.id,
      reference_number: "HR-2024-077",
      source_department: "HR",
      assigned_to: "bob@office.com",
      assigned_to_name: "Bob Smith",
      created_by: "alice@office.com",
      created_by_name: "Alice Johnson",
      priority: "low" as const,
      status: "in_progress" as const,
      due_date: nextWeek,
      reminder_option: "15min_before" as const,
      tags: "hr,handbook,policy",
    },
    {
      id: randomUUID(),
      title: "Data Backup Verification",
      description: "Verify all critical data backups are working correctly",
      category_id: catIT.id,
      reference_number: "IT-2024-088",
      source_department: "IT",
      assigned_to: "bob@office.com",
      assigned_to_name: "Bob Smith",
      created_by: "admin@office.com",
      created_by_name: "Admin User",
      priority: "high" as const,
      status: "completed" as const,
      due_date: yesterday,
      completed_at: today + "T09:00:00.000Z",
      reminder_option: "1hr_before" as const,
      tags: "IT,backup,data",
    },
    {
      id: randomUUID(),
      title: "Team Building Event Planning",
      description: "Plan Q3 team building activity for staff",
      category_id: catHR.id,
      reference_number: "HR-2024-091",
      source_department: "HR",
      assigned_to: "alice@office.com",
      assigned_to_name: "Alice Johnson",
      created_by: "alice@office.com",
      created_by_name: "Alice Johnson",
      priority: "low" as const,
      status: "not_started" as const,
      due_date: nextWeek,
      reminder_option: "none" as const,
      tags: "hr,team-building,events",
    },
  ];

  await db.insert(tasksTable).values(tasks).onConflictDoNothing();
  console.log(`✓ ${tasks.length} tasks seeded`);

  // Activity logs
  const activityLogs = tasks.map((task) => ({
    id: randomUUID(),
    task_id: task.id,
    user_email: task.created_by,
    user_name: task.created_by_name,
    action_type: "created" as const,
    action_details: `Task "${task.title}" created`,
  }));

  await db.insert(taskActivityLogsTable).values(activityLogs).onConflictDoNothing();
  console.log("✓ Activity logs seeded");

  console.log("\n✅ Database seeded successfully!");
  console.log("Login credentials:");
  console.log("  Admin:  admin@office.com / admin123");
  console.log("  User 1: alice@office.com / user123");
  console.log("  User 2: bob@office.com   / user123");
}

seed().catch(console.error).finally(() => process.exit(0));
