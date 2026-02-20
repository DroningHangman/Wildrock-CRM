export interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  contact_types: string[] | null;
  organization: string | null;
  tags: string[] | null;
  notes: string | null;
  referred_by: string | null;
  marketing_consent: boolean | null; // Marketing/email consent (contact-level property)
  created_at?: string;
}

export interface Booking {
  id: string;
  contact_id: string | null;
  booking_type: string | null;
  date: string | null;
  timeslot: string | null;
  program_name: string | null;
  kids_count: number | null;
  notes: string | null;
  form_responses?: Record<string, unknown> | null; // JSONB field for dynamic form answers
  report_data?: Record<string, unknown> | null; // Manual enrichment data from Reports tab
  contacts?: Contact | null;
}

export interface Document {
  id: string;
  contact_id: string | null;
  booking_id: string | null;
  name: string | null;
  url: string | null;
  type: string | null;
  uploaded_at?: string;
}

export interface Membership {
  id: string;
  contact_id: string | null;
  membership_type: string | null;
  start_date: string | null;
  end_date: string | null;
  code: string | null;
  status: string | null;
}

export interface DocumentFile {
  name: string;
  path: string;
  contactId: string;
}

export interface Entity {
  id: string;
  name: string;
  entity_type: 'household' | 'school' | 'organization';
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at?: string;
  contact_entity_roles?: { count: number }[];
}

export interface RelationshipType {
  id: string;
  entity_type: string;
  name: string;
  is_default: boolean;
  created_at?: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'currency';
  default?: string | number | boolean;
}

export interface FieldSchema {
  fields: FieldDefinition[];
  aggregations?: string[];
  show_contact: boolean;
  show_entity: boolean;
}

export interface ProgramType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  field_schema: FieldSchema;
  created_at?: string;
}

export interface ProgramEntry {
  id: string;
  program_type_id: string;
  date: string;
  contact_id: string | null;
  entity_id: string | null;
  data: Record<string, unknown>;
  notes: string | null;
  created_at?: string;
  contacts?: { id: string; name: string | null } | null;
  entities?: { id: string; name: string | null } | null;
}

export interface ContactEntityRole {
  id: string;
  contact_id: string;
  entity_id: string;
  role: string;
  notes: string | null;
  created_at?: string;
  contacts?: { id: string; name: string | null; email: string | null } | null;
  entities?: { id: string; name: string | null; entity_type: string } | null;
}
