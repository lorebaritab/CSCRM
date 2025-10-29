# Internal Operations Platform

Fresh workspace ready to scaffold a unified sales, support, and stock management system.

## Suggested Stack
- **Vercel + Next.js** for the internal web UI
- **Supabase** (Postgres + Auth + Storage) as the system of record
- **Tailwind CSS / Shadcn UI** for rapid, consistent internal tooling components
- **Resend / Postmark** for transactional mails (notifications, ticket updates)
- **Sentry** and Vercel Analytics for monitoring

## Core Modules to Plan
1. **Sales CRM** – accounts, deals, pipeline stages, activity log
2. **Support Desk** – tickets, SLA tracking, canned replies
3. **Inventory** – product catalog, stock movements, reorder alerts
4. **Shared CRM Data** – contacts, organisations, notes
5. **Reporting** – dashboards, exports, scheduled summaries

## Immediate Next Steps
1. Finalise data model: ER diagram for contacts, deals, tickets, stock, audit tables
2. Provision Supabase project(s) (dev/staging/prod) and set RLS/auth policies early
3. Scaffold Next.js 14+ app with app router, Auth helpers, and component library
4. Implement baseline pages: auth gate, dashboard shell, nav, placeholder modules
5. Automate infra: lint/test workflow, quality hooks, deployment targets

## Database Setup

Initial Postgres objects live in `supabase/migrations/20250221120000_initial_schema.sql` and define:

- `profiles` (extends `auth.users` with roles, names, territories)
- CRM entities (`customers`, `catalog_items`, `offers`, `offer_items`, `offer_approvals`)
- Offer reference counters, helper functions, triggers, and row-level security policies
- `documents` metadata for the internal file repository

### Apply with Supabase CLI

```
# install once
npm install -g supabase

# initialise local project metadata (creates supabase/config.toml)
supabase init

# link to a Supabase project (repeat per environment)
supabase link --project-ref <project-ref>

# reset your local database to match migrations
supabase db reset --schema public

# or push migrations straight to the linked project (use with care)
supabase db push
```

Helper functions such as `public.is_manager()` and the RLS policies expect each authenticated user to receive a `profiles` row via the `handle_new_user` trigger. Seed the appropriate roles (`sales_rep`, `manager`, `admin`) after the first login events.

## Working Directory
Repository is currently empty — add app code, database migrations, and tooling from scratch.
