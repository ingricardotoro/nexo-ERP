---
name: Installed UI Components
description: List of all shadcn/ui and custom UI components installed in src/components/ui/
type: project
---

## Components in `src/components/ui/`

All confirmed present as of Fase 2 (Contacts module):

- alert.tsx
- alert-dialog.tsx — custom implementation using @radix-ui/react-alert-dialog (installed manually)
- avatar.tsx
- badge.tsx
- button.tsx — exports `buttonVariants` (used by alert-dialog)
- card.tsx
- checkbox.tsx — custom implementation using @radix-ui/react-checkbox (installed manually)
- dialog.tsx
- dropdown-menu.tsx
- form.tsx
- input.tsx
- label.tsx
- select.tsx
- separator.tsx
- skeleton.tsx
- sonner.tsx
- switch.tsx
- table.tsx
- tabs.tsx — custom implementation using @radix-ui/react-tabs (installed manually)
- textarea.tsx — custom implementation (no radix dependency)

## Radix-UI packages installed in package.json

- @radix-ui/react-avatar
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-label
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slot
- @radix-ui/react-switch
- @radix-ui/react-tabs (added for Contacts module)
- @radix-ui/react-checkbox (added for Contacts module)
- @radix-ui/react-alert-dialog (added for Contacts module)

## Contact-specific components in `src/components/contacts/`

- contact-type-badge.tsx — uses getContactTypeLabel/getContactTypeVariant from contact.schema
- contact-role-badge.tsx — uses getContactRoleLabel/getContactRoleBadgeVariant from contact.schema
- contact-status-badge.tsx — green=active (default), gray=inactive (secondary)
- contacts-table.tsx — TanStack Table v8, server-side pagination/sort, AlertDialog for delete

## Invoicing-specific components in `src/components/invoicing/`

- invoice-status-badge.tsx — DRAFT=gray, PUBLISHED=blue, PAID=green, CANCELLED=red
- invoice-type-badge.tsx — FACTURA=violet, NOTA_CREDITO=amber, NOTA_DEBITO=orange
- invoices-table.tsx — TanStack Table v8, server-side pagination/sort, row click nav
- format-currency.ts — `formatCurrency(amount, currencyCode)` → "L 1,234.56" / "$ 1,234.56"; `formatTaxRate(rate)` → "15.00%"
