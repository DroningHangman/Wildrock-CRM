# Cal.com → Acuity Migration Plan

## Context
The MVP uses Cal.com for booking sync. Production will switch to Acuity Scheduling.
The Cal.com webhook handler (`app/api/webhooks/cal/route.ts`) is purpose-built for
Cal.com's data format and cannot simply be repointed at Acuity — the data shape,
authentication, and fetch flow are all fundamentally different.

---

## What Changes and Why

### 1. Webhook Flow (the biggest change)

**Cal.com:** Webhook POST contains the full booking payload.

**Acuity:** Webhook POST is form-encoded and contains only the appointment ID.
Your server must make a follow-up authenticated GET to fetch the full data:
```
GET https://acuityscheduling.com/api/v1/appointments/{id}
Authorization: Basic base64(userId:apiKey)
```

### 2. Custom Field Format

**Cal.com** — named string keys:
```json
{ "kids_attending": { "label": "Kids Attending", "value": "3", "isHidden": false } }
```

**Acuity** — numeric IDs inside a nested array:
```json
{
  "forms": [{
    "id": 1,
    "name": "Intake Form",
    "values": [
      { "fieldID": 42, "name": "How many kids?", "value": "3" }
    ]
  }]
}
```
Field IDs must be discovered via Acuity's `/api/v1/forms` endpoint before building the handler.

### 3. form_responses JSONB Shape
Currently `form_responses` stores Cal.com's raw `{ label, value, isHidden }` objects.
`app/bookings/page.tsx` has `extractCleanValue()` and `extractLabel()` that assume this shape.
After migration, the stored shape will differ — the UI will break if not addressed.

---

## Recommended Architecture

### Decision 1: Normalize on Ingest (Canonical Format)
Before storing `form_responses`, the webhook handler should normalize to a flat canonical format:
```json
{
  "kids_attending": "3",
  "phone": "555-1234",
  "marketing_consent": "true"
}
```
This means **the UI (`app/bookings/page.tsx`) never needs to know which provider sent the data**.
`extractCleanValue()` and `extractLabel()` become trivial (values are already plain strings).
Both the Cal.com and Acuity handlers write the same shape — historical bookings stay readable.

### Decision 2: Separate Route File per Provider
Create `/api/webhooks/acuity/route.ts` as a new file. Do NOT repurpose the cal route.
- Keeps the Cal.com handler intact during any overlap period
- Each file is self-contained and easier to reason about
- Cal.com route can be deleted when fully decommissioned

### Decision 3: Field ID Config File
Store Acuity field ID mappings in `lib/acuity-field-config.ts` (not env vars, not DB):
```typescript
// lib/acuity-field-config.ts
export const ACUITY_FIELDS = {
  kids_attending: [42, 87, 103],  // fieldID per event type form (same question, different IDs)
  phone: [11, 56, 88],
  marketing_consent: [15, 60, 91],
}
```
Reason: version-controlled, easy to update, no deploy needed for config-only changes if
later moved to env vars, and avoids over-engineering with a DB table.

---

## Files to Create / Modify

### New File: `app/api/webhooks/acuity/route.ts`
Full rewrite — not a copy of the Cal.com handler. Key logic:
1. Parse form-encoded body → extract `id`
2. GET `https://acuityscheduling.com/api/v1/appointments/{id}` with Basic Auth
3. Helper: `extractAcuityField(forms, fieldIDs[])` — loops `forms[].values[]`, matches on fieldID
4. Normalize all extracted fields to canonical flat format
5. Find/create contact (same logic as Cal.com handler)
6. Insert booking with `booking_type: 'acuity_sync'` and normalized `form_responses`

### New File: `lib/acuity-field-config.ts`
Field ID lookup table (populated after running Acuity `/forms` discovery).

### Modify: `app/bookings/page.tsx`
- `extractCleanValue()` — simplify: values will be plain strings post-normalization
- `extractLabel()` — simplify or remove
- `getRelevantFields()` — update field name strings if any change with canonical naming

### Modify: `app/api/webhooks/cal/route.ts`
- Also normalize `form_responses` to canonical format before storing (aligns historical data)
- Small change: unwrap `{ label, value }` and store just the string value per key

### No Schema Changes Required
The `bookings` table schema supports this migration as-is:
- `form_responses jsonb` — works for any flat key:value shape
- `booking_type text` — `'acuity_sync'` vs `'cal_sync'` already distinguishable
- `kids_count int` — extracted the same way regardless of provider

---

## New Environment Variables Needed
```
ACUITY_USER_ID=...       # Found in Acuity account settings
ACUITY_API_KEY=...       # Found in Acuity account settings
```
Add to Vercel env vars and `.env.local`.

---

## Pre-Migration Steps (Manual, in Acuity)

1. Create intake forms on Acuity event types that mirror the Cal.com forms
2. Call `GET /api/v1/forms` with credentials to get all fieldIDs
3. Populate `lib/acuity-field-config.ts` with the discovered IDs
4. Register webhook URL in Acuity: `https://your-app.vercel.app/api/webhooks/acuity`

---

## Migration Sequence

1. Build `lib/acuity-field-config.ts` (after Acuity form setup)
2. Build `app/api/webhooks/acuity/route.ts`
3. Update `app/api/webhooks/cal/route.ts` to normalize `form_responses`
4. Update `app/bookings/page.tsx` display helpers
5. Test end-to-end with Acuity test booking
6. Decommission Cal.com webhook and delete the cal route file
