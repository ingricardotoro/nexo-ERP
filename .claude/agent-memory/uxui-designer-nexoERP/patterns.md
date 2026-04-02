---
name: Approved Code Patterns
description: Confirmed layout and implementation patterns used across NexoERP pages
type: project
---

## Page Structure Pattern (list pages)

All list pages follow the users page pattern exactly:
1. `'use client'` directive
2. State: searchQuery, currentPage, sortBy, sortDirection, data[], totalCount, loading, isRefetching, error
3. `fetchData` in `useCallback` with all filter dependencies
4. `useEffect` calls `fetchData(true)` on mount (showMainLoading=true)
5. Error card at top when error and not loading
6. Header: h1 + description + primary action Button
7. Stats cards grid (3 columns, md:grid-cols-3)
8. Filter card with search Input + Select filters
9. Data card with table component

## Page Structure Pattern (form pages — create/edit)

1. `'use client'` directive
2. Back button (ArrowLeft icon, variant="outline" size="icon") → router.push
3. h1 title + description
4. Single Card with form inside
5. React Hook Form + Zod resolver
6. `isSubmitting` state, button disabled + Loader2 spinner + "Guardando..." text
7. Cancel button → router.push back
8. Fetch optional data (payment terms) in useCallback on mount

## Contact Module API Endpoints

- `GET /api/v1/contacts` — list with filters: search, type, role, isActive, page, limit, orderBy, orderDir
- `POST /api/v1/contacts` — create
- `GET /api/v1/contacts/:id` — detail with nested addresses[] and persons[]
- `PUT /api/v1/contacts/:id` — update
- `DELETE /api/v1/contacts/:id` — delete
- `GET /api/v1/contacts/payment-terms` — list payment terms for Select
- `POST /api/v1/contacts/:id/addresses` — add address
- `POST /api/v1/contacts/:id/persons` — add person of contact

## Route Structure for Contacts

- `/dashboard/contacts` → `src/app/(dashboard)/contacts/page.tsx`
- `/dashboard/contacts/new` → `src/app/(dashboard)/contacts/new/page.tsx`
- `/dashboard/contacts/[id]` → `src/app/(dashboard)/contacts/[id]/page.tsx`
- `/dashboard/contacts/[id]/edit` → `src/app/(dashboard)/contacts/[id]/edit/page.tsx`

## Fetch Pattern

Always use `credentials: 'include'` in all fetch calls.
Response shape: `{ success: boolean, data?: T, pagination?: {...}, error?: string }`

## Empty/Null Field Handling for API Calls

Before POSTing/PUTting, convert empty strings to null for nullable fields:
```ts
const body = {
  ...data,
  rtn: data.rtn || null,
  tradeName: data.tradeName || null,
  email: data.email || null,
  // ...
};
```

## Select with Nullable Value Pattern

Use `"none"` as sentinel value, convert to null before sending:
```tsx
<Select
  value={field.value ?? 'none'}
  onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
>
  <SelectItem value="none">Sin selección</SelectItem>
  ...
</Select>
```

## Destructive Action Pattern

Always use AlertDialog (not window.confirm) for irreversible actions:
- Import from `@/components/ui/alert-dialog`
- State: `deleteDialogOpen`, `itemToDelete`
- AlertDialogAction gets `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"`
- AlertDialogCancel is default

## Tab Detail Page Pattern (contact detail)

- Tabs component from `@/components/ui/tabs`
- Tab "Información": two-column grid of Cards
- Tab "Direcciones": Card with Add button + grid of address cards or empty state
- Tab "Personas de Contacto": Card with Add button + grid of person cards or empty state
- Add actions open Dialog modals with Form inside
- Dialog reset on close: `onOpenChange={(open) => { setOpen(open); if (!open) form.reset(); }}`

## Validation Schema Helpers Location

All in `@/lib/validations/`:
- `contact.schema.ts` — createContactSchema, updateContactSchema, formatRtn, getContactTypeLabel, getContactTypeVariant, getContactRoleLabel, getContactRoleBadgeVariant
- `contact-address.schema.ts` — createContactAddressSchema, getAddressTypeLabel
- `contact-person.schema.ts` — createContactPersonSchema
  - Note: field is `jobTitle` (NOT `position`)
- `payment-terms.schema.ts` — createPaymentTermsSchema
- `invoice.schema.ts` — createInvoiceSchema, updateInvoiceSchema, listInvoicesSchema
- `cai.schema.ts` — createCaiSchema, updateCaiSchema (CAI_REGEX, DOCUMENT_TYPES: '01'|'03'|'04')
- `tax-rate.schema.ts` — createTaxRateSchema, updateTaxRateSchema (rate is 0–1 decimal)

## React Hook Form + Zod Schema Compatibility

NEVER use `z.infer<typeof schemaWithDefaults>` directly as the generic for `useForm<T>`. Schemas that use `.default()` or complex chaining cause incompatible Resolver types. Instead:
- Define a local form schema without `.default()` for fields that need it
- Use `z.infer<typeof localFormSchema>` as the generic type
- Map values to API format in `onSubmit` before fetching

## Invoicing Module Routes

- `/dashboard/invoicing/invoices` → `src/app/(dashboard)/invoicing/invoices/page.tsx`
- `/dashboard/invoicing/invoices/new` → `src/app/(dashboard)/invoicing/invoices/new/page.tsx`
- `/dashboard/invoicing/invoices/[id]` → `src/app/(dashboard)/invoicing/invoices/[id]/page.tsx`
- `/dashboard/invoicing/cais` → `src/app/(dashboard)/invoicing/cais/page.tsx`
- `/dashboard/invoicing/tax-rates` → `src/app/(dashboard)/invoicing/tax-rates/page.tsx`

## Invoicing API Endpoints

- `GET/POST /api/v1/invoicing/invoices` — list (pagination, filters) / create draft
- `GET/PATCH/DELETE /api/v1/invoicing/invoices/:id` — detail / update draft / delete draft
- `POST /api/v1/invoicing/invoices/:id/publish` — DRAFT → PUBLISHED (assigns SAR number)
- `POST /api/v1/invoicing/invoices/:id/cancel` — PUBLISHED → CANCELLED (needs cancelReason, min 5 chars)
- `GET/POST /api/v1/invoicing/cais` — list all / create
- `GET/PATCH /api/v1/invoicing/cais/:id` — detail / toggle isActive
- `GET/POST /api/v1/invoicing/tax-rates` — list all / create
- `GET/PATCH /api/v1/invoicing/tax-rates/:id` — detail / update (name, rate, isActive)

## CAI Expiry Pattern

Use `differenceInDays(new Date(expiresAt), new Date())` from date-fns:
- daysLeft <= 0 (isPast): red "Vencido"
- daysLeft <= 30: amber "Vence en {N}d" with AlertTriangle icon
- daysLeft > 30 and isActive: green "Activo"
- !isActive: gray "Inactivo"
