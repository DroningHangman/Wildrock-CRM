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
  form_responses jsonb, -- Stores dynamic form answers (allergies, emergency contact, etc.) per event type
  report_data jsonb default '{}' -- Manual enrichment data entered via Reports (owes, paid, etc.)
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

-- program types (defines report schemas)
create table program_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  field_schema jsonb not null,
  created_at timestamp default now()
);

-- program entries (individual records per program type)
create table program_entries (
  id uuid primary key default gen_random_uuid(),
  program_type_id uuid references program_types(id) on delete cascade,
  date date not null,
  contact_id uuid references contacts(id) on delete set null,
  entity_id uuid references entities(id) on delete set null,
  data jsonb not null default '{}',
  notes text,
  created_at timestamp default now()
);

-- seed program types
insert into program_types (name, slug, description, field_schema) values
(
  'Playscape', 'playscape', 'Daily playscape attendance log',
  '{"fields":[{"key":"children_count","label":"# of Children","type":"number"},{"key":"adults_count","label":"# of Adults","type":"number"}],"aggregations":["children_count","adults_count"],"show_contact":false,"show_entity":false}'
),
(
  'Field Trip', 'field-trip', 'School and organization field trips',
  '{"fields":[{"key":"playscape_blocked","label":"Playscape blocked?","type":"boolean"},{"key":"children_count","label":"# of Children","type":"number"},{"key":"chaperones_count","label":"# of Chaperones","type":"number"},{"key":"teachers_count","label":"# of Teachers","type":"number"},{"key":"amount_due","label":"Amount Due","type":"currency"},{"key":"invoice_sent","label":"Invoice Sent","type":"boolean"},{"key":"amount_paid","label":"Amount Paid","type":"currency"}],"aggregations":["children_count","chaperones_count","teachers_count","amount_due","amount_paid"],"show_contact":false,"show_entity":true}'
),
(
  'Birthday Party', 'birthday-party', 'Birthday party bookings',
  '{"fields":[{"key":"children_count","label":"# of Children","type":"number"},{"key":"adults_count","label":"# of Adults","type":"number"},{"key":"owes","label":"Owes","type":"currency"},{"key":"paid","label":"Paid?","type":"boolean"}],"aggregations":["owes"],"show_contact":true,"show_entity":false}'
),
(
  'Volunteers', 'volunteers', 'Volunteer tracking and compliance',
  '{"fields":[{"key":"hours","label":"Hours","type":"number"},{"key":"participants","label":"# Participants","type":"number"},{"key":"background_checked","label":"Background checked","type":"boolean"},{"key":"waiver_signed","label":"Waiver signed","type":"boolean"}],"aggregations":["hours","participants"],"show_contact":true,"show_entity":false}'
);
