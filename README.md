# Wildrock CRM

Lightweight internal CRM MVP for Wildrock: playscape events, school programs, and donor engagement.

**Stack:** Next.js 14 (App Router), TailwindCSS, ShadCN UI, Supabase. Hosted on Vercel.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL Editor (Dashboard → SQL Editor).
3. Create a storage bucket named `documents` (Dashboard → Storage). Store PDFs at `{contact_id}/{filename}.pdf`.
4. Copy `.env.example` to `.env.local` and set your Supabase project URL and anon key.

**Pages:** Contacts (search, filter, contact types, tags, notes) · Bookings (filter by date, booking type, contact) · Documents (upload/list/download PDFs per contact; waiver, medical_form, etc.) · Admin (CSV import, tags in use).

**CSV import:** Headers `name`, `email`, `phone`, `contact_types`, `organization`, `tags`, `notes`. `name` required. `contact_types` and `tags` comma-separated.

## Getting started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
