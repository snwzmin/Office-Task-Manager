import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, getAuthUser } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "BadRequest", message: "email and password required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user || !user.is_active) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }
  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      avatar_url: user.avatar_url,
      is_active: user.is_active,
      created_at: user.created_at.toISOString(),
      updated_at: user.updated_at.toISOString(),
    },
  });
});

router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, authUser.id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "NotFound", message: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    avatar_url: user.avatar_url,
    is_active: user.is_active,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  });
});

export default router;
