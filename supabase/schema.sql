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
  marketing_consent boolean, -- Marketing/email consent (contact-level property)
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

-- entities (households, schools, organizations)
create table entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entity_type text not null, -- 'household', 'school', 'organization'
  description text,
  website text,
  phone text,
  email text,
  address text,
  metadata jsonb,
  created_at timestamp default now()
);

-- predefined + user-created relationship types per entity type
create table relationship_types (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  name text not null,
  is_default boolean default false,
  created_at timestamp default now(),
  unique(entity_type, name)
);

-- contact-to-entity associations with role
create table contact_entity_roles (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  entity_id uuid references entities(id) on delete cascade,
  role text not null,
  notes text,
  created_at timestamp default now(),
  unique(contact_id, entity_id, role)
);

-- seed default relationship types
insert into relationship_types (entity_type, name, is_default) values
  ('household', 'Member', true),
  ('household', 'Mother', false),
  ('household', 'Father', false),
  ('household', 'Child', false),
  ('household', 'Guardian', false),
  ('school', 'Member', true),
  ('school', 'Teacher', false),
  ('school', 'Parent', false),
  ('school', 'Administrator', false),
  ('organization', 'Member', true);
