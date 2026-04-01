---
name: Mock de request.formData() para preservar bytes de archivos binarios en tests
description: NextRequest({ body: formData }) en jsdom corrompe los bytes de archivos XLSX. La solución es mockear req.formData() directamente.
type: feedback
---

**Problema identificado en F2-03 (contact-import-api.test.ts):**

Cuando se construye un NextRequest con `body: formData` en el ambiente jsdom/Vitest,
los bytes binarios de archivos XLSX se corrompen durante la serialización multipart.
El handler recibe bytes como `75 6e 64 65` ("unde") en lugar de los magic bytes
`50 4B 03 04` del XLSX. Esto hace que todos los tests de archivos válidos fallen con 415.

**Por qué:** jsdom serializa FormData multipart de forma diferente al runtime de Next.js.
El File/Blob pierde integridad binaria al atravesar la serialización.

**Síntomas:**
- Tests que deberían retornar 200/422 devuelven 415 ("El archivo no es un .xlsx válido")
- El MIME type SÍ se preserva (file.type correcto)
- El nombre del File se pierde (aparece como "blob")
- Object.defineProperty en `size` tampoco funciona después del round-trip

**Solución:** Mockear `request.formData()` directamente con vi.fn():

```typescript
function crearRequestConFile(file: File | string | null): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/...', { method: 'POST' });
  const fd = new FormData();
  if (file !== null) fd.set('file', file);
  // CLAVE: mockear formData() para evitar serialización multipart
  req.formData = vi.fn().mockResolvedValue(fd);
  return req;
}
```

**Para simular archivos grandes (test de límite de tamaño):**
Object.defineProperty funciona correctamente en el File ANTES de meterlo en FormData.
El handler lee `file.size` del File en el FormData mockeado, no del body serializado:

```typescript
function crearFileConTamanoFicticio(tamanoBytes: number): File {
  const buf = construirXlsxBuffer({});
  const file = new File([buf], 'grande.xlsx', { type: MIME_XLSX });
  return Object.defineProperty(file, 'size', { get: () => tamanoBytes }) as File;
}
```

**Archivo de referencia:** `src/__tests__/unit/contact-import-api.test.ts`
