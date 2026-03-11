# F0-02: Configuración de AWS Amplify Gen 2

> **ID:** F0-02
> **Fase:** 0 — Fundación
> **Prioridad:** 🔴 Crítica
> **Estimación:** 3–4 horas
> **Dependencias:** F0-01 (Setup proyecto)
> **Bloquea a:** F0-07 (Ambientes)

---

## 1. Objetivo

Configurar AWS Amplify Gen 2 como la plataforma de hosting, CI/CD, autenticación (Cognito) y almacenamiento (S3) para NexoERP. Establecer la conexión entre el proyecto local y los servicios AWS necesarios para la Fase 0.

---

## 2. Prerrequisitos

| Requisito        | Detalle                                             | Verificación                    |
| ---------------- | --------------------------------------------------- | ------------------------------- |
| F0-01 completado | Proyecto Next.js 15 funcional                       | `npm run dev` funciona          |
| Cuenta AWS       | Con acceso a la consola y permisos de administrador | Login en console.aws.amazon.com |
| AWS CLI v2       | Instalado y configurado                             | `aws --version`                 |
| Amplify CLI      | @aws-amplify/backend-cli v1.x                       | Se instala como dependencia     |
| Región           | `us-east-1` configurada como default                | `aws configure get region`      |
| Presupuesto      | AWS Budgets configurado con alerta a $45/mes        | Verificar en AWS Console        |

---

## 3. Pasos de Implementación

### 3.1 Configurar perfil AWS (si no existe)

```powershell
# Configurar credenciales AWS
aws configure
# AWS Access Key ID: [tu-key]
# AWS Secret Access Key: [tu-secret]
# Default region name: us-east-1
# Default output format: json

# Verificar
aws sts get-caller-identity
```

### 3.2 Instalar dependencias de Amplify

```powershell
# Backend (IaC)
npm install --save-dev @aws-amplify/backend@latest @aws-amplify/backend-cli@latest

# Cliente (frontend)
npm install aws-amplify @aws-amplify/adapter-nextjs
```

### 3.3 Inicializar estructura de Amplify

Crear la estructura de directorios de Amplify Gen 2:

```powershell
New-Item -ItemType Directory -Path "amplify/auth" -Force
New-Item -ItemType Directory -Path "amplify/storage" -Force
New-Item -ItemType Directory -Path "amplify/functions" -Force
New-Item -ItemType Directory -Path "amplify/data" -Force
```

### 3.4 Configurar `amplify/backend.ts` (Punto de entrada IaC)

```typescript
// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { storage } from './storage/resource';

/**
 * NexoERP — Backend Definition (Amplify Gen 2)
 *
 * Define todos los recursos de backend:
 * - Auth: Cognito User Pool con 5 roles RBAC
 * - Storage: S3 para documentos de empresas
 *
 * @see https://docs.amplify.aws/gen2/build-a-backend/
 */
const backend = defineBackend({
  auth,
  storage,
});

// === Configuración adicional de CDK (si es necesario) ===

// Ejemplo: agregar tags a todos los recursos
const stack = backend.createStack('NexoERPCustomStack');
// Futuras personalizaciones de CDK van aquí
```

### 3.5 Configurar `amplify/auth/resource.ts` (Cognito)

```typescript
// amplify/auth/resource.ts
import { defineAuth } from '@aws-amplify/backend';

/**
 * NexoERP — Configuración de Autenticación (Cognito)
 *
 * Configuración del User Pool con:
 * - Login por email
 * - Verificación de email obligatoria
 * - Política de contraseñas robusta
 * - Grupos para RBAC (se crean en Fase 1)
 *
 * Roles RBAC del sistema:
 * - administrador: Acceso total
 * - gerente: CRUD operativo
 * - contador: Contabilidad y facturación
 * - vendedor: Ventas y CRM
 * - auditor: Solo lectura + auditoría
 *
 * @see REQUIREMENTS.md §7.1 RF-CORE-01, RF-CORE-05, RF-CORE-10
 * @see REQUIREMENTS.md §9.7 RS-AUTH-01 a RS-AUTH-06
 */
export const auth = defineAuth({
  loginWith: {
    email: {
      // Configuración de verificación de email
      verificationEmailStyle: 'CODE',
      verificationEmailSubject: 'NexoERP — Código de verificación',
      verificationEmailBody: (createCode) =>
        `Tu código de verificación para NexoERP es: ${createCode()}`,
    },
  },

  // Política de contraseñas (RS-AUTH-02)
  // Mínimo 8 caracteres, mayúscula, número, carácter especial
  // (Cognito por defecto requiere: 8 chars, upper, lower, number, special)

  // Atributos del usuario
  userAttributes: {
    // Nombre completo del usuario
    fullname: {
      mutable: true,
      required: true,
    },
    // Locale para i18n (futuro)
    locale: {
      mutable: true,
      required: false,
    },
  },

  // Multi-factor authentication (RS-AUTH-03)
  // TOTP opcional por defecto, obligatorio para Admin se controla en app
  multifactor: {
    mode: 'OPTIONAL',
    totp: true,
  },

  // Configuración de cuenta
  accountRecovery: 'EMAIL_ONLY',
});
```

### 3.6 Configurar `amplify/storage/resource.ts` (S3)

```typescript
// amplify/storage/resource.ts
import { defineStorage } from '@aws-amplify/backend';

/**
 * NexoERP — Configuración de Almacenamiento (S3)
 *
 * Bucket para documentos de empresas:
 * - Logos de empresas
 * - Facturas PDF generadas
 * - Reportes exportados
 * - Archivos adjuntos
 *
 * Estructura de paths:
 *   {company_id}/logos/
 *   {company_id}/invoices/{year}/{month}/
 *   {company_id}/reports/{year}/
 *   {company_id}/attachments/
 *
 * Seguridad:
 * - Block Public Access habilitado
 * - Acceso solo via pre-signed URLs
 * - Aislamiento por empresa via paths + policies
 *
 * @see REQUIREMENTS.md §9.6 RS-ENC-03, RS-ENC-04
 */
export const storage = defineStorage({
  name: 'nexoerpDocuments',
  access: (allow) => ({
    // Logos de empresa: el owner puede subir/leer, auth users pueden leer
    'companies/{entity_id}/logos/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.authenticated.to(['read']),
    ],
    // Documentos protegidos por empresa (facturas, reportes)
    // El acceso real se controla en la API verificando company_id del JWT
    'companies/{entity_id}/documents/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
    // Archivos temporales para import/export
    'temp/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
  }),
});
```

### 3.7 Configurar `amplify/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 3.8 Configurar Amplify client en Next.js

```typescript
// src/lib/amplify/config.ts
'use client';

import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

/**
 * Configuración del cliente Amplify para el frontend.
 * Se ejecuta una sola vez al cargar la app.
 *
 * amplify_outputs.json es generado por `npx ampx sandbox` o `npx ampx generate outputs`
 * y está en .gitignore (es diferente por ambiente).
 */
Amplify.configure(outputs, {
  ssr: true, // Habilitar SSR support para Next.js App Router
});

export default function AmplifyConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

```typescript
// src/lib/amplify/server.ts
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import outputs from '../../amplify_outputs.json';

/**
 * Server-side Amplify utilities para:
 * - Server Components
 * - API Route Handlers
 * - Middleware
 */
export const { runWithAmplifyServerContext } = createServerRunner({
  config: outputs,
});
```

### 3.9 Integrar Amplify en el layout raíz

Actualizar `src/app/layout.tsx` para incluir el provider:

```tsx
// src/app/layout.tsx — agregar import y wrapper
import AmplifyConfigProvider from '@/lib/amplify/config';

// En el body del layout:
<body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
  <AmplifyConfigProvider>{children}</AmplifyConfigProvider>
</body>;
```

### 3.10 Crear sandbox de desarrollo

```powershell
# Iniciar el sandbox de Amplify (crea recursos efímeros en AWS)
npx ampx sandbox
```

**Primera ejecución:**

- Creará un CloudFormation stack con sufijo del developer
- Provisionará Cognito User Pool, S3 bucket
- Generará `amplify_outputs.json` en la raíz del proyecto
- Mostrará el endpoint del sandbox

**Output esperado:**

```
✔  Deployment successful
  amplify_outputs.json was updated.

  Amplify sandbox is now watching for file changes...
```

> **Importante:** El sandbox es efímero y vinculado al developer. Cada developer tiene su propio sandbox. No compartir `amplify_outputs.json`.

### 3.11 Verificar servicios creados

```powershell
# Verificar User Pool creado
aws cognito-idp list-user-pools --max-results 10

# Verificar S3 bucket
aws s3 ls | Select-String "nexoerp"
```

### 3.12 Configurar AWS Budget Alert

```powershell
# Crear presupuesto con alerta a $45/mes
aws budgets create-budget `
  --account-id (aws sts get-caller-identity --query Account --output text) `
  --budget '{
    "BudgetName": "NexoERP-Monthly",
    "BudgetLimit": { "Amount": "50", "Unit": "USD" },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' `
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 90,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "tu-email@dominio.com"
    }]
  }]'
```

> **Nota:** Reemplazar `tu-email@dominio.com` con el email real del administrador.

### 3.13 Detener sandbox al terminar

```powershell
# Ctrl+C en la terminal del sandbox, o:
npx ampx sandbox delete
```

---

## 4. Estructura Resultante

```
amplify/
├── backend.ts                  # Punto de entrada IaC
├── auth/
│   └── resource.ts             # Cognito User Pool config
├── storage/
│   └── resource.ts             # S3 bucket config
├── functions/                  # (vacío, se usa en Fase 3)
├── data/                       # (vacío, referencia futura)
└── tsconfig.json               # TypeScript config para Amplify

src/lib/amplify/
├── config.ts                   # Client-side Amplify config
└── server.ts                   # Server-side Amplify utilities

amplify_outputs.json            # (generado, gitignored)
```

---

## 5. Criterios de Aceptación

| #   | Criterio                                                 | Verificación                            |
| --- | -------------------------------------------------------- | --------------------------------------- |
| 1   | `@aws-amplify/backend` y `aws-amplify` instalados        | `package.json`                          |
| 2   | `amplify/backend.ts` define auth y storage               | Archivo existe con configuración        |
| 3   | Cognito User Pool creado con login por email             | `aws cognito-idp list-user-pools`       |
| 4   | Cognito tiene política de contraseñas robusta            | 8+ chars, upper, lower, number, special |
| 5   | MFA TOTP configurado como opcional                       | Configuración en `auth/resource.ts`     |
| 6   | S3 bucket creado con estructura de paths por empresa     | `aws s3 ls`                             |
| 7   | S3 tiene Block Public Access habilitado                  | Configuración de bucket                 |
| 8   | `amplify_outputs.json` generado y en `.gitignore`        | Verificar ambos                         |
| 9   | `npx ampx sandbox` completa sin errores                  | CloudFormation stack desplegado         |
| 10  | Cliente Amplify configurado en Next.js (client + server) | Archivos en `src/lib/amplify/`          |
| 11  | Layout raíz incluye AmplifyConfigProvider                | `src/app/layout.tsx`                    |
| 12  | AWS Budget configurado con alerta a $45/mes (90%)        | AWS Budgets console                     |
| 13  | Sandbox se puede crear y destruir sin errores            | `sandbox` + `sandbox delete`            |

---

## 6. Checklist de Verificación

```
□ AWS CLI configurado con credenciales correctas
□ Región us-east-1 como default
□ Dependencias de Amplify instaladas
□ amplify/backend.ts creado
□ amplify/auth/resource.ts configurado
□ amplify/storage/resource.ts configurado
□ amplify/tsconfig.json creado
□ src/lib/amplify/config.ts (client-side)
□ src/lib/amplify/server.ts (server-side)
□ Layout integra AmplifyConfigProvider
□ npx ampx sandbox ejecuta exitosamente
□ amplify_outputs.json generado
□ amplify_outputs.json en .gitignore
□ Cognito User Pool visible en AWS Console
□ S3 bucket visible en AWS Console
□ S3 Block Public Access verificado
□ AWS Budget creado con alerta
□ Sandbox eliminado después de verificación
□ npm run build compila sin errores
```

---

## 7. Seguridad — Verificaciones Obligatorias

| Verificación                           | Estado esperado                             |
| -------------------------------------- | ------------------------------------------- |
| Cognito Advanced Security              | Habilitado (se activa en Fase 1, por costo) |
| S3 Block Public Access                 | 4 opciones activadas                        |
| S3 Server-Side Encryption              | SSE-S3 por defecto                          |
| `amplify_outputs.json` en `.gitignore` | ✅                                          |
| No hay credenciales en código          | ✅ — solo en `.env.local` y AWS CLI profile |
| Tokens en HTTP-only cookies            | Configurado en Fase 1 (middleware auth)     |

---

## 8. Notas Técnicas

- **Amplify Gen 2** usa CDK bajo el hood. El `backend.ts` es el punto de entrada del constructo CDK.
- **Sandbox mode** crea recursos reales en AWS pero con suffix del developer. Cada developer tiene su sandbox aislado.
- **`amplify_outputs.json`** es el equivalente del `amplifyconfiguration.json` de Gen 1. Contiene endpoints, IDs de User Pool, bucket names, etc.
- **SSR Support:** El `adapter-nextjs` es necesario para usar Amplify en Server Components y API Routes.
- **Costo en Fase 0:** El sandbox es efímero y se destruye al hacer `sandbox delete`. Solo genera costo mientras está activo (< $1/día típicamente).
- **Cognito Groups** para los 5 roles RBAC (administrador, gerente, contador, vendedor, auditor) se crean en la Fase 1 (F1-05, F1-06) cuando se implemente el flujo de usuarios.
- **No configurar SES en esta fase** — se configura en Fase 3 con Lambda.
