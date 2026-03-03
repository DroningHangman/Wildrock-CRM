# wildrock-crm — Claude Notes

## Production Architecture: Migrating from Cal.com to Acuity
> Full migration plan, architectural decisions, and implementation sequence: [`docs/acuity-migration-plan.md`](docs/acuity-migration-plan.md)

The current MVP uses **Cal.com** for bookings. Production will use **Acuity Scheduling**.
The webhook handler (`app/api/webhooks/cal/route.ts`) will need to be **substantially rewritten** — not just the field extraction logic, but the entire data-fetching flow.

### Key Differences

| | Cal.com (MVP) | Acuity (Production) |
|---|---|---|
| Webhook payload | Full appointment data included | Only sends appointment ID |
| Custom fields format | Named keys: `responses.kids_attending` = `{ label, value, isHidden }` | Numeric IDs: `forms[].values[].fieldID` + `.value` |
| Field lookup | By string identifier (e.g. `kids_attending`) | By numeric `fieldID` (e.g. `42`) |
| Extra API call needed? | No | Yes — must `GET /api/v1/appointments/{id}` to get full data |

### Cal.com Field Format (MVP)
```json
{
  "responses": {
    "kids_attending": { "label": "Kids Attending", "value": "3", "isHidden": false }
  }
}
```
Use the `extractValue()` helper to unwrap `{ label, value }` before parsing.

### Acuity Field Format (Production)
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
Look up fields by numeric `fieldID`, not by name string.

### Acuity Webhook Flow
1. Acuity POSTs `appointmentID` (form-encoded) to your endpoint
2. Your handler calls `GET https://acuityscheduling.com/api/v1/appointments/{id}` with Basic Auth
3. Parse the full response including `forms[].values[]` for custom field data

### Current MVP Field Identifier
The kids count field identifier on Cal.com forms is standardized to `kids_attending`.
The webhook reads this field directly — no fallbacks.
