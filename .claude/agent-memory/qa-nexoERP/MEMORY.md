# QA NexoERP — Memoria del Agente

- [Patrón vi.hoisted para mocks de Prisma y servicios](feedback-vihoisted-mocks.md) — Usar siempre vi.hoisted() al declarar mocks que referencian variables en factories de vi.mock()
- [Patrón mock de request.formData() para archivos binarios en tests](feedback-binary-file-tests.md) — jsdom corrompe bytes de archivos en NextRequest({ body: formData }); usar req.formData = vi.fn() en cambio
- [Normalización RTN en tests de duplicados](feedback-rtn-normalization.md) — normalizeRtn('0801-1990-00001') produce '0801199000001' (13 dígitos), no 14; sincronizar valor en mocks de DB
- [Comportamiento del refine con path en Zod](feedback-zod-refine-path.md) — refine con path:['campo'] va a fieldErrors.campo, no a formErrors; solo sin path va a formErrors
- [Mock de $transaction con callback y array](feedback-transaction-mock-patterns.md) — usar typeof arg === 'function' para discriminar callback vs array en el mismo mockImplementation
- [Códigos HTTP de handleApiError](feedback-handleapierror-status-codes.md) — ZodError→422, NOT_FOUND_MESSAGES→404, todo lo demás (incluso AuthError)→400
- [Patrones de testing de componentes con Radix y date-fns](feedback-component-testing-patterns.md) — Fechas timezone-safe (usar T12:00:00Z), userEvent para DropdownMenu Radix, nunca getByRole('generic')
