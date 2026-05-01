import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production. Set it before starting the server.");
  }
  console.warn(
    "[auth] WARNING: JWT_SECRET is not set. Using an insecure default for development only. " +
    "Set JWT_SECRET before deploying to production."
  );
}

const EFFECTIVE_SECRET = JWT_SECRET ?? "office-task-mgmt-dev-only-secret";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, EFFECTIVE_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, EFFECTIVE_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }
  const token = authHeader.slice(7);
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    return;
  }
  (req as Request & { user: AuthUser }).user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }
  next();
}

export function getAuthUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

/** Returns true when the given user may read/write the task (admin or task creator/assignee). */
export function canAccessTask(
  authUser: AuthUser,
  task: { created_by: string; assigned_to: string | null }
): boolean {
  return (
    authUser.role === "admin" ||
    task.created_by === authUser.email ||
    task.assigned_to === authUser.email
  );
}
