# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PWD Observatory — a platform for managing and profiling Persons with Disabilities (PWDs). Features include PWD registration/profiling, district unions, service providers, counselling centres, jobs, events, knowledge management, organizations, and reporting/analytics.

## Tech Stack

- **Monorepo:** Bun workspaces (`packages/server`, `packages/client`)
- **Frontend:** React 18 + TypeScript, Vite, Apollo Client (GraphQL), Tailwind CSS + MUI + Radix UI
- **Backend:** Express 5 + Apollo Server 4 (GraphQL), MySQL, Bun runtime
- **Auth:** JWT-based with role-based permissions (stored as JSON in roles table)

## Commands

```bash
# Install dependencies (from root)
bun install

# Frontend (packages/client/)
cd packages/client && bun run dev      # Vite dev server
cd packages/client && bun run build    # tsc + vite build
cd packages/client && bun run lint     # ESLint with auto-fix

# Backend (packages/server/)
cd packages/server && bun run dev      # Watch mode: bun --watch server.js
```

No test suite is configured yet.

## Architecture

### Backend (`packages/server/`)

- **Entry:** `server.js` — Express + Apollo Server setup with graphql-upload middleware
- **Config:** `config/config.js` — MySQL pool, JWT secret (`PRIVATE_KEY`), port (9000), image URLs
- **Schema:** `schema/` — Feature-based modules, each with `typeDefs.js` + `resolvers.js`, auto-merged via `@graphql-tools/load-files` + `@graphql-tools/merge` in `schema/index.js`
- **Feature modules:** `pwd`, `user`, `dashboard`, `districts`, `disabilities`, `role`, `products`, `innovations`, `knowledge`, `jobs`, `events`, `news`, `service_providers`, `counselling_centres`, `organisations`, `reports`, `import_pwds`, `response` (shared types only)
- **Auth middleware:** `middleware/auth.js` — JWT verification, attaches decoded user to `req.user`
- **DB helper:** `utils/db/saveData.js` — generic insert/update wrapper (`saveData({ table, id, data })`); pass `id` to update, omit for insert. Supports array data for batch inserts. Used across all resolvers.
- **SQL migrations:** `sql/` — numbered migration files (`001_auth_schema.sql` through `014_pwd_alternative_phone.sql`); full dump at `sql/pwd_observatory.sql`

#### REST endpoints (in `server.js`, alongside GraphQL)

- `GET /templates/pwd-profiling-template.xlsx` — generates Excel import template with dynamic dropdowns from DB (districts, disabilities, genders)
- `GET /verify/seed-label/:id` — public seed label verification page (HTML response)
- `GET /countries` — proxy to external countries API
- Static files served from `public/`

#### Auth-exempt GraphQL operations

Operations listed in `exemptOperations` in `server.js` skip JWT auth: `Login`, `IntrospectionQuery`, `System_settings`, `Register`, `RequestPasswordResetLink`, `ResetPasswordWithToken`, `PublicPwdCount`, `DashboardStats`. All others require a valid Bearer token.

### Frontend (`packages/client/`)

- **Entry:** `src/main.tsx` — Apollo Client setup with auth link (Bearer token from localStorage via `src/auth/_helpers.ts`)
- **Routing:** React Router v6 with `<RequireAuth>` and `<PermissionGuard>` wrappers
- **GraphQL operations:** `src/gql/*.ts` — all queries and mutations, organized by feature
- **Pages:** `src/pages/{feature}/` — feature-based page organization (23 page directories including `landing`, `dashboards`, `pwd`, `reports`, etc.)
- **Auth:** `src/auth/providers/JWTProvider.tsx` — JWT context provider
- **Providers stack:** Settings, Layout, Loaders, Translation (react-intl), Menus, Pathname — composed in `src/providers/`
- **Menu config:** `src/config/menu.config.tsx` — declarative sidebar with `requiredPermissions`
- **i18n:** `src/i18n/messages/{en,fr,ar,zh}.json`
- **API URL config:** `src/config/urls.ts` — `MAIN_URL` (GraphQL) and `URL_2` (REST base), both default to `localhost:9000`
- **UI toolkit:** Metronic Tailwind React v9.1.2 base with Radix UI primitives, MUI components, Formik + Yup for forms, ApexCharts + ECharts for data viz, Leaflet for maps

### Key Patterns

- **Permission checks in resolvers:** `hasPermission(userPermissions, 'can_view_pwds')` / `ensurePermission(...)` before data access (see `schema/user/resolvers.js`, `schema/pwd/resolvers.js`, etc.)
- **Soft deletes:** queries filter with `WHERE deleted = 0`
- **Audit fields:** `created_by`, `updated_by`, `created_at`, `updated_at` on most tables
- **Excel bulk import:** template-based PWD data import with column mapping and validation (`import_pwds` module)
- **GraphQL endpoint:** `http://localhost:9000/graphql`

### Database

- MySQL database named `pwd_observatory`
- Connection configured in `packages/server/config/config.js` (localhost, root, no password, pool of 10)
- Full dump available at `packages/server/sql/pwd_observatory.sql`
