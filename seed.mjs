import pg from "pg";
import { scryptSync, randomBytes } from "crypto";

const { Client } = pg;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const SEED_USERS = [
  { email: "admin@office.com", name: "Admin User",  role: "admin", password: "admin123" },
  { email: "user@office.com",  name: "Staff User",  role: "user",  password: "user123"  },
  { email: "alice@office.com", name: "Alice Smith", role: "user",  password: "user123"  },
  { email: "bob@office.com",   name: "Bob Jones",   role: "user",  password: "user123"  },
];

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query("SELECT COUNT(*) FROM users");
    const count = parseInt(rows[0].count, 10);

    if (count > 0) {
      console.log(`[seed] Users table already has ${count} row(s) — skipping seed.`);
      return;
    }

    for (const u of SEED_USERS) {
      const id = randomBytes(16).toString("hex");
      const password_hash = hashPassword(u.password);
      await client.query(
        `INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [id, u.email, u.name, password_hash, u.role]
      );
      console.log(`[seed] Created ${u.role}: ${u.email}`);
    }

    console.log("[seed] Done.");
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error("[seed] Error:", err.message);
  process.exit(1);
});
