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

## Working Directory
Repository is currently empty — add app code, database migrations, and tooling from scratch.
