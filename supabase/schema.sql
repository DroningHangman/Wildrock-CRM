-- Wildrock CRM – Supabase schema (run in SQL Editor)
-- Storage: create bucket "documents" in Dashboard → Storage. Store files at {contact_id}/{filename}.pdf

-- contacts
create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  contact_types text[],
  organization text,
  tags text[],
  notes text,
  referred_by uuid references contacts(id),
  created_at timestamp default now()
);

-- bookings
create table bookings (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id),
  booking_type text,
  date date,
  timeslot text,
  program_name text,
  kids_count int,
  marketing_consent boolean, -- Common field: marketing/email consent (filterable)
  notes text,
  form_responses jsonb -- Stores dynamic form answers (allergies, emergency contact, etc.) per event type
);

-- documents (metadata; actual files in storage bucket "documents")
create table documents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id),
  booking_id uuid references bookings(id),
  name text,
  url text,
  type text,
  uploaded_at timestamp default now()
);

-- memberships
create table memberships (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id),
  membership_type text,
  start_date date,
  end_date date,
  code text,
  status text
);
