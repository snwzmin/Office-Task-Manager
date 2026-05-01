# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

This is a full-featured **Office Task Management System** with:
- React+Vite frontend (artifacts/office-tasks) 
- Express+PostgreSQL API backend (artifacts/api-server)
- JWT authentication with role-based access (admin/user)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React 18 + Vite 7 + Tailwind CSS + shadcn/ui
- **State**: TanStack Query v5

## Architecture

### Packages
- `lib/db` — Drizzle ORM schema + migrations + seed
- `lib/api-spec` — OpenAPI 3.0 spec + Orval codegen config
- `lib/api-client-react` — Generated React Query hooks from OpenAPI spec
- `artifacts/api-server` — Express API server (port 8080)
- `artifacts/office-tasks` — React+Vite frontend (port 25936)

### Port Routing (Replit)
- Frontend: port 25936, preview path `/` (all frontend routes)
- API: port 8080, accessible via `/api/*` through Replit's routing proxy

### Auth
- JWT tokens stored in localStorage("auth_token")
- `setAuthTokenGetter(() => localStorage.getItem("auth_token"))` called at module init in App.tsx
- `useGetMe` in Layout verifies auth on each route (staleTime: 60s via global QueryClient)

### Seed Data (dev only)
- admin@office.com / admin123 (role: admin)
- alice@office.com / user123 (role: user)
- bob@office.com / user123 (role: user)
- 5 categories, 15 tasks

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `PORT=25936 BASE_PATH=/ pnpm --filter @workspace/office-tasks run build` — build frontend

## Important Notes

### Routing (wouter v3)
- App.tsx uses flat Switch/Route structure — do NOT use nested Switch inside Route (causes blank pages)
- Each protected page wraps `<Layout>` directly: `<Route path="/tasks/new"><Layout><TaskForm /></Layout></Route>`

### API Client Pattern
- `useGetCategories(undefined, { query: { queryKey: ... } })` — params is first arg (pass undefined), options is second
- `useGetTasks(params, { query: { queryKey: ... } })` — params is first arg
- `useGetMe({ query: { queryKey: ... } })` — no params, options is first arg
- All mutations use `{ id, data }` shape (not `taskId`)
- Categories/Users APIs return arrays directly (not wrapped objects)

### Task Status Values
`not_started` | `in_progress` | `waiting_for_response` | `deferred` | `completed` | `cancelled`

### Task Priority Values
`low` | `medium` | `high` | `urgent`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
