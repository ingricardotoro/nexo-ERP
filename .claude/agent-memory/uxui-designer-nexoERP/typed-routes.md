---
name: Next.js Typed Routes Handling
description: How to handle router.push with dynamic params when typedRoutes: true is enabled
type: feedback
---

Next.js `typedRoutes: true` is enabled in `next.config.ts`. This causes TS errors when using
`router.push` with dynamic route segments (e.g., template literals with `${id}`).

**Why:** `RouteImpl<T>` type does not accept plain strings with dynamic interpolation unless the
route is pre-defined in the type system. Template literals with runtime values fail type checks.

**How to apply:** Cast all `router.push(...)` calls that use dynamic params or string literals that
are not statically known routes with `as never`:

```ts
// Static route that TypeScript doesn't know about:
router.push('/dashboard/contacts' as never)

// Dynamic route with runtime id:
router.push(`/dashboard/contacts/${contactId}` as never)
router.push(`/dashboard/contacts/${contactId}/edit` as never)
```

Use `as never` (not `as any`) — it satisfies the RouteImpl constraint without widening types.
