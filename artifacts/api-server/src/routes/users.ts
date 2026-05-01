import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { generateId } from "../lib/id";

const router: IRouter = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    department: u.department,
    avatar_url: u.avatar_url,
    is_active: u.is_active,
    created_at: u.created_at.toISOString(),
    updated_at: u.updated_at.toISOString(),
  };
}

router.get("/users", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select().from(usersTable).orderBy(asc(usersTable.name));
  res.json(rows.map(formatUser));
});

router.get("/users/active", requireAuth, async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      department: usersTable.department,
    })
    .from(usersTable)
    .where(eq(usersTable.is_active, true))
    .orderBy(asc(usersTable.name));
  res.json(rows);
});

router.post("/users", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const body = req.body as {
    email: string;
    name: string;
    password: string;
    role?: string;
    department?: string;
  };

  if (!body.email || !body.name || !body.password) {
    res.status(400).json({ error: "BadRequest", message: "email, name, password required" });
    return;
  }

  const hash = await bcrypt.hash(body.password, 10);
  const id = generateId();

  await db.insert(usersTable).values({
    id,
    email: body.email.toLowerCase(),
    name: body.name,
    password_hash: hash,
    role: (body.role as "admin" | "user") || "user",
    department: body.department,
  });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.status(201).json(formatUser(user));
});

router.put("/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const body = req.body as {
    name?: string;
    role?: string;
    department?: string;
    is_active?: boolean;
    avatar_url?: string;
  };

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "NotFound", message: "User not found" });
    return;
  }

  await db
    .update(usersTable)
    .set({
      name: body.name ?? existing.name,
      role: (body.role as "admin" | "user") ?? existing.role,
      department: body.department ?? existing.department,
      is_active: body.is_active ?? existing.is_active,
      avatar_url: body.avatar_url ?? existing.avatar_url,
      updated_at: new Date(),
    })
    .where(eq(usersTable.id, id));

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.json(formatUser(updated));
});

export default router;
