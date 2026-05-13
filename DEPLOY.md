# Office Task Management — Deployment Guide (Docker / Dokploy)

This document covers deploying with Docker on a VPS managed by Dokploy.

---

## Quick start

Push the repository to GitHub. In Dokploy, point to the repo root — it will build
using the `Dockerfile` at the root and start with `docker-entrypoint.sh`.

The entrypoint runs automatically on every container start:
1. `node /app/migrate.cjs` — idempotent schema migration (safe to re-run)
2. `node /app/seed.cjs` — seeds default users only if the `users` table is empty
3. `node /app/dist/index.mjs` — starts the Express server on `PORT` (default 3000)

---

## Required environment variables (Dokploy → Environment)

| Variable | Example / Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | `postgres://user:pass@host:5432/dbname` |
| `JWT_SECRET` | Random 64-char string — **required in production** |
| `STORAGE_PROVIDER` | `s3` |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `task-files-prod` |
| `S3_ACCESS_KEY_ID` | R2 API token Access Key ID |
| `S3_SECRET_ACCESS_KEY` | R2 API token Secret Access Key |
| `S3_FORCE_PATH_STYLE` | `true` |

---

## Cloudflare R2 setup

### 1. Create bucket

Bucket name: **`task-files-prod`**

Cloudflare dashboard → R2 → Create bucket.
**Keep public access disabled.**

### 2. Create API token

R2 → Manage R2 API Tokens → Create API Token.

- Permissions: **Object Read & Write**
- Scope: `task-files-prod` bucket only
- Copy **Access Key ID** and **Secret Access Key** into Dokploy env vars.

### 3. R2 CORS policy

The browser uploads files **directly to R2** using a short-lived presigned PUT URL.
R2 must allow PUT requests from your production domain.

Cloudflare dashboard → R2 → `task-files-prod` → Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": ["https://tasks.yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> Replace the origin with your exact production URL — **no trailing slash**.
> If your domain changes later, add the new origin to this list.
> Without it, browser uploads fail with a CORS error even though the presigned URL is valid.

### 4. Verify connectivity (AWS CLI)

```bash
AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> \
  aws s3 ls s3://task-files-prod/ \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  --region auto
```

---

## Upload flow (browser → R2, credentials never exposed)

1. Browser `POST /api/storage/uploads/request-url` → `{ file_name, file_size, content_type }`
2. Backend validates extension, MIME type, size; generates `objects/<uuid>` key;
   returns a **5-minute presigned PUT URL** — R2 secrets never leave the server.
3. Browser `PUT <presigned_url>` with file body directly to R2.
4. Browser `POST /api/tasks/:id/attachments` → `{ file_name, file_url: objectKey, file_type, file_size, stored_filename: objectKey }`
5. Backend saves only the object key (not a public URL) to PostgreSQL.

---

## Download flow (authenticated server-side streaming)

`GET /api/tasks/:taskId/attachments/:attachmentId/download`

- **401** if not logged in.
- **403** if the user cannot access the task.
- **404** if the object key does not exist in R2.
- Fetches the object from R2 server-side and streams it to the browser.
- Headers set: `Content-Disposition: attachment`, `Cache-Control: no-store`.

**Incognito test:** open the download URL without logging in — you must receive
`{"message":"Not authenticated"}` (401), not the file.

---

## Delete behavior

`DELETE /api/tasks/:taskId/attachments/:attachmentId`

- Requires login. Only admin or the original uploader may delete.
- Deletes the PostgreSQL record **first** (data integrity guaranteed).
- Attempts `DeleteObjectCommand` against R2 — failure is **logged but not fatal**.
  The 204 response is still returned; the database is never left in a bad state.

---

## Authorization model

| Role | Access |
|---|---|
| Admin | All tasks and all attachments |
| Task creator | Attachments on tasks they created |
| Assigned user | Attachments on tasks assigned to them |
| Other users | 403 Forbidden |

All checks are enforced server-side. Frontend button visibility is cosmetic only.

---

## Seeded users (first boot only — skipped if users table is non-empty)

| Email | Password | Role |
|---|---|---|
| `admin@office.com` | `admin123` | admin |
| `user@office.com` | `user123` | user |
| `alice@office.com` | `user123` | user |
| `bob@office.com` | `user123` | user |

**Change passwords immediately after first login in production.**

---

## Docker internals

- Builder: `node:20-bookworm-slim` (glibc for native binaries)
- Runner: `node:20-alpine` (minimal final image)
- `migrate.cjs` / `seed.cjs` are **CJS bundles** (not ESM) so `pg`'s dynamic
  `require()` of Node built-ins (`events`, `stream`, etc.) works inside Alpine.
- esbuild binary resolved from `artifacts/api-server/node_modules/.bin/esbuild`
  (not root `node_modules`) — the root workspace does not install esbuild.
- `UPLOAD_DIR=/app/uploads` — only used when `STORAGE_PROVIDER` is unset (local dev).

---

## Security checklist before go-live

- [ ] R2 bucket public access is **disabled**
- [ ] No public R2 URLs stored in the database
- [ ] No long-lived presigned GET URLs generated
- [ ] `JWT_SECRET` is a strong random 64-char value
- [ ] Database port not exposed to the public internet
- [ ] R2 API token scoped to `task-files-prod` only
- [ ] Production domain added to R2 CORS `AllowedOrigins`
