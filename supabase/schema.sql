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
  report_data jsonb default '{}', -- Manual enrichment data entered via Reports (owes, paid, etc.)
  cal_uid text unique -- Cal.com booking UID; used to update/delete on reschedule/cancel (added via: ALTER TABLE bookings ADD COLUMN cal_uid text UNIQUE)
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

-- ============================================================
-- Row-Level Security (RLS)
-- All tables are restricted to authenticated users only.
-- Every authenticated user is treated as a trusted admin;
-- add a roles/claims check here if you need multi-tenant isolation.
-- ============================================================

-- contacts
alter table contacts enable row level security;
create policy "Authenticated users can read contacts"
  on contacts for select to authenticated using (true);
create policy "Authenticated users can insert contacts"
  on contacts for insert to authenticated with check (true);
create policy "Authenticated users can update contacts"
  on contacts for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete contacts"
  on contacts for delete to authenticated using (true);

-- bookings
alter table bookings enable row level security;
create policy "Authenticated users can read bookings"
  on bookings for select to authenticated using (true);
create policy "Authenticated users can insert bookings"
  on bookings for insert to authenticated with check (true);
create policy "Authenticated users can update bookings"
  on bookings for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete bookings"
  on bookings for delete to authenticated using (true);

-- documents
alter table documents enable row level security;
create policy "Authenticated users can read documents"
  on documents for select to authenticated using (true);
create policy "Authenticated users can insert documents"
  on documents for insert to authenticated with check (true);
create policy "Authenticated users can update documents"
  on documents for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete documents"
  on documents for delete to authenticated using (true);

-- memberships
alter table memberships enable row level security;
create policy "Authenticated users can read memberships"
  on memberships for select to authenticated using (true);
create policy "Authenticated users can insert memberships"
  on memberships for insert to authenticated with check (true);
create policy "Authenticated users can update memberships"
  on memberships for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete memberships"
  on memberships for delete to authenticated using (true);

-- entities
alter table entities enable row level security;
create policy "Authenticated users can read entities"
  on entities for select to authenticated using (true);
create policy "Authenticated users can insert entities"
  on entities for insert to authenticated with check (true);
create policy "Authenticated users can update entities"
  on entities for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete entities"
  on entities for delete to authenticated using (true);

-- relationship_types
alter table relationship_types enable row level security;
create policy "Authenticated users can read relationship_types"
  on relationship_types for select to authenticated using (true);
create policy "Authenticated users can insert relationship_types"
  on relationship_types for insert to authenticated with check (true);
create policy "Authenticated users can update relationship_types"
  on relationship_types for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete relationship_types"
  on relationship_types for delete to authenticated using (true);

-- contact_entity_roles
alter table contact_entity_roles enable row level security;
create policy "Authenticated users can read contact_entity_roles"
  on contact_entity_roles for select to authenticated using (true);
create policy "Authenticated users can insert contact_entity_roles"
  on contact_entity_roles for insert to authenticated with check (true);
create policy "Authenticated users can update contact_entity_roles"
  on contact_entity_roles for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete contact_entity_roles"
  on contact_entity_roles for delete to authenticated using (true);

-- program_types
alter table program_types enable row level security;
create policy "Authenticated users can read program_types"
  on program_types for select to authenticated using (true);
create policy "Authenticated users can insert program_types"
  on program_types for insert to authenticated with check (true);
create policy "Authenticated users can update program_types"
  on program_types for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete program_types"
  on program_types for delete to authenticated using (true);

-- program_entries
alter table program_entries enable row level security;
create policy "Authenticated users can read program_entries"
  on program_entries for select to authenticated using (true);
create policy "Authenticated users can insert program_entries"
  on program_entries for insert to authenticated with check (true);
create policy "Authenticated users can update program_entries"
  on program_entries for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete program_entries"
  on program_entries for delete to authenticated using (true);

-- ============================================================
-- seed program types
-- Email tables
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_html text not null,
  body_text text,
  variables text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table email_sends (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  campaign_id uuid,  -- reserved for Phase 2 campaigns
  template_id uuid references email_templates(id) on delete set null,
  to_email text not null,
  subject text not null,
  status text not null default 'queued',
  resend_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table email_templates enable row level security;
create policy "Authenticated users can read email_templates" on email_templates for select to authenticated using (true);
create policy "Authenticated users can insert email_templates" on email_templates for insert to authenticated with check (true);
create policy "Authenticated users can update email_templates" on email_templates for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete email_templates" on email_templates for delete to authenticated using (true);

alter table email_sends enable row level security;
create policy "Authenticated users can read email_sends" on email_sends for select to authenticated using (true);
create policy "Authenticated users can insert email_sends" on email_sends for insert to authenticated with check (true);
create policy "Authenticated users can update email_sends" on email_sends for update to authenticated using (true) with check (true);

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
