import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, getAuthUser } from "../lib/auth";
import { generateId } from "../lib/id";

const router: IRouter = Router();

function formatCategory(c: typeof categoriesTable.$inferSelect) {
  return {
    ...c,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  };
}

router.get("/categories", requireAuth, async (req: Request, res: Response) => {
  const { active_only } = req.query as { active_only?: string };
  let rows = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
  if (active_only === "true") {
    rows = rows.filter((c) => c.is_active);
  }
  res.json(rows.map(formatCategory));
});

router.post("/categories", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as {
    name: string;
    description?: string;
    color?: string;
    is_active?: boolean;
  };

  if (!body.name) {
    res.status(400).json({ error: "BadRequest", message: "name is required" });
    return;
  }

  const id = generateId();
  await db.insert(categoriesTable).values({
    id,
    name: body.name,
    description: body.description,
    color: body.color || "#2563eb",
    is_active: body.is_active ?? true,
  });

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id)).limit(1);
  res.status(201).json(formatCategory(cat));
});

router.put("/categories/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as Partial<typeof categoriesTable.$inferInsert>;

  const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "NotFound", message: "Category not found" });
    return;
  }

  await db
    .update(categoriesTable)
    .set({ ...body, updated_at: new Date() })
    .where(eq(categoriesTable.id, id));

  const [updated] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id)).limit(1);
  res.json(formatCategory(updated));
});

router.delete("/categories/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.status(204).send();
});

export default router;
