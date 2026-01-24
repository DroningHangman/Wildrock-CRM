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
