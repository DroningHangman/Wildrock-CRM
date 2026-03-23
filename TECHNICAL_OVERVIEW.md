# Wildrock CRM — Technical Overview

## 1. Project Purpose

Internal CRM MVP for Wildrock (a nature playscape and discovery center in Crozet, VA). Manages contacts, bookings (playscape visits, field trips, birthday parties), memberships, documents, and relationships to entities (households, schools, organizations). Integrates with Cal.com for booking sync and supports CSV import for bulk contact onboarding.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui (Radix primitives), Geist + Amatic SC fonts |
| **Backend** | Next.js API Routes (single webhook), Supabase PostgREST |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (email/password), session cookies via `@supabase/ssr` |
| **Storage** | Supabase Storage (bucket `documents` for PDFs) |
| **Infra** | Vercel (hosting), Supabase (BaaS) |
| **Integrations** | Cal.com (webhook for booking sync) |

---

## 3. Directory Structure

```
wildrock-crm/
├── app/
│   ├── api/webhooks/cal/     # Cal.com webhook handler (POST)
│   ├── admin/                # CSV import, tags management
│   ├── bookings/             # Bookings list + filters
│   ├── contacts/             # Contacts CRUD, 360 view, relationships
│   ├── documents/            # Document upload/list per contact
│   ├── login/                # Auth page
│   ├── members/              # Memberships management
│   ├── relationships/        # Entity-relationship management
│   ├── reports/              # Program entries, aggregations
│   ├── globals.css            # Tailwind + CSS variables (brand colors)
│   ├── layout.tsx             # Root layout, fonts, Nav
│   └── page.tsx               # Redirects to /bookings
├── components/
│   ├── Nav.tsx                # Main navigation (client)
│   ├── CaptureWaiverModal.tsx # Waiver capture + PDF generation
│   └── ui/                    # shadcn components (button, card, dialog, etc.)
├── lib/
│   ├── supabase.ts            # Browser client (createBrowserClient)
│   ├── supabase-server.ts     # Server client (createServerClient, cookie-based)
│   └── utils.ts               # cn() for Tailwind merge
├── supabase/
│   └── schema.sql             # Full schema + seed data
├── types/
│   └── index.ts               # TypeScript interfaces (Contact, Booking, etc.)
├── middleware.ts              # Auth guard, session refresh
└── .env.example               # NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY (for webhook)
```

---

## 4. Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Supabase as BaaS** | Offloads auth, DB, storage, RLS. No custom backend needed. |
| **Client-side data fetching** | All main pages are `"use client"` and call `supabase.from(...)` directly. Keeps the app simple; no API layer for CRUD. |
| **Single webhook route** | Cal.com integration is isolated in `/api/webhooks/cal`. Uses service role key to bypass RLS for contact/booking creation. |
| **Cookie-based auth** | `@supabase/ssr` + middleware refresh sessions on every request. Protects all routes except `/login`, `/api/webhooks/*`, and `/`. |
| **JSONB for flexible fields** | `form_responses` (bookings) and `report_data` store event-specific data without schema changes. `field_schema` in `program_types` drives Reports UI. |
| **Entity-relationship model** | Contacts link to entities (households, schools, orgs) via `contact_entity_roles` with configurable relationship types. Supports many-to-many. |
| **shadcn/ui** | Radix-based, accessible, Tailwind-native. No heavy UI framework. |

---

## 5. Data Flow — Typical Request

**Example: User views Contacts page**

1. **Request** → `GET /contacts`
2. **Middleware** → Runs first. Creates Supabase server client, calls `getUser()`. If no session → redirect to `/login`. If session exists → `NextResponse.next()`.
3. **Page** → `app/contacts/page.tsx` (client component). On mount, `useEffect` calls `supabase.from("contacts").select("*")` (or `supabase.rpc("contacts_by_participation", ...)` when participation filter is active).
4. **Supabase** → PostgREST translates to SQL. RLS policies apply (anon key). Returns JSON.
5. **React** → `setContacts(data)`. Table/cards render. User can open 360-view dialog, which triggers additional fetches for bookings, memberships, documents, relationships.

**Example: Cal.com webhook creates a booking**

1. **Request** → `POST /api/webhooks/cal` (from Cal.com)
2. **Middleware** → Webhook path is excluded from auth; request proceeds.
3. **Route handler** → Creates Supabase client with **service role key** (bypasses RLS). Parses payload, finds/creates contact by email, inserts booking with `form_responses` JSONB.
4. **Response** → `{ success: true }` or error.

---

## 6. Patterns Used

- **Client-side data layer** — No repository or service layer. Components call Supabase client directly. `useState` + `useEffect` for fetch-on-mount; `useCallback` for refetch functions.
- **Composition over abstraction** — Reusable UI via shadcn primitives; page-level logic stays in page components. No shared hooks for Supabase queries.
- **TypeScript interfaces** — `types/index.ts` mirrors DB schema. Used for type safety; no runtime validation (e.g. Zod).
- **Modal-based editing** — Contact 360 view, add contact, export, etc. use Radix Dialog. State lives in parent page.
- **Tailwind + CSS variables** — Design tokens in `globals.css` (`--primary`, `--foreground`, etc.). Theme-aware; dark mode defined but not surfaced in UI.

---

## 7. Known Pain Points / Uncertainties

| Area | Notes |
|------|-------|
| **RLS policies** | Schema does not define RLS in `schema.sql`. Supabase project may have policies configured separately. Unclear if anon key is restricted per-user. |
| **`contacts_by_participation` RPC** | Referenced in Contacts page but not defined in `schema.sql`. Must exist in Supabase as a custom function. Not version-controlled with schema. |
| **Webhook auth** | Cal.com webhook has no signature verification. Relies on URL secrecy. Consider adding HMAC or shared secret validation. |
| **Service role key** | Required for webhook; not in `.env.example`. Must be added manually for Cal.com sync to work. |
| **Large page components** | `contacts/page.tsx` is ~870 lines. State and logic are co-located; could benefit from extraction (e.g. custom hooks, subcomponents). |
| **No error boundaries** | Unhandled errors in client components may show blank screen. No global error boundary. |
| **Form validation** | Uses `alert()` for validation feedback. No structured form library (React Hook Form, etc.). |

---

## 8. Built vs Planned

**Built**

- Auth (login, middleware guard)
- Contacts (CRUD, search, filters, entity/participation filters, 360 view, relationships, CSV export)
- Bookings (list, filters, Cal.com sync, form_responses display)
- Documents (upload, list, download, waiver capture with signature + PDF)
- Memberships (CRUD, status)
- Relationships (entities, contact_entity_roles, relationship types)
- Reports (program entries by type, field_schema-driven UI, aggregations)
- Admin (CSV import, tags-in-use view)
- Wildrock branding (green palette, Amatic SC font, semantic tokens)

**Planned / Not Yet Implemented**

- Dark mode toggle (tokens exist, no UI)
- RLS policies in schema (if not managed elsewhere)
- `contacts_by_participation` in schema (or migration)
- Webhook signature verification
- Structured form validation
- Error boundaries
