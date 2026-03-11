# F0-01: Setup del Proyecto Next.js 15

> **ID:** F0-01
> **Fase:** 0 — Fundación
> **Prioridad:** 🔴 Crítica (bloquea todas las demás tareas)
> **Estimación:** 2–3 horas
> **Dependencias:** Ninguna
> **Bloquea a:** F0-02, F0-03, F0-04, F0-05, F0-06, F0-07, F0-08, F0-09

---

## 1. Objetivo

Inicializar el proyecto NexoERP con Next.js 15, React 19, TypeScript 5 y Tailwind CSS 4, estableciendo la estructura de directorios base y la configuración mínima necesaria para que el resto de tareas de la Fase 0 puedan ejecutarse.

---

## 2. Prerrequisitos

| Requisito  | Versión mínima | Verificación                                                         |
| ---------- | -------------- | -------------------------------------------------------------------- |
| Node.js    | 20.x LTS       | `node --version`                                                     |
| npm        | 10.x+          | `npm --version`                                                      |
| Git        | 2.40+          | `git --version`                                                      |
| PowerShell | 5.1+           | `$PSVersionTable.PSVersion`                                          |
| VS Code    | latest         | Con extensiones: ESLint, Prettier, Tailwind CSS IntelliSense, Prisma |

---

## 3. Pasos de Implementación

### 3.1 Crear el proyecto Next.js

```powershell
# Desde la raíz del workspace (donde está docs/)
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

**Opciones esperadas en el wizard interactivo:**

- TypeScript: **Yes**
- ESLint: **Yes**
- Tailwind CSS: **Yes**
- `src/` directory: **Yes**
- App Router: **Yes**
- Turbopack: **Yes**
- Import alias: **@/\***

> **Nota:** Si el directorio no está vacío (tiene `docs/`, `.claude/`), `create-next-app` puede mostrar advertencia. Confirmar que se desea continuar. Si no lo permite, crear en un directorio temporal y copiar los archivos.

### 3.2 Verificar versiones instaladas

```powershell
npx next --version    # Debe ser 15.x
npx tsc --version     # Debe ser 5.x
```

Verificar en `package.json`:

```json
{
  "dependencies": {
    "next": "^15.x",
    "react": "^19.x",
    "react-dom": "^19.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x",
    "@types/node": "^20.x",
    "tailwindcss": "^4.x"
  }
}
```

### 3.3 Configurar `next.config.ts`

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Habilitar Turbopack para desarrollo
  // (ya habilitado por defecto en Next.js 15 con --turbopack)

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Configuración experimental
  experimental: {
    // Habilitar typed routes para App Router
    typedRoutes: true,
  },

  // Imágenes - dominios permitidos
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
    ],
  },

  // Redirección HTTP → HTTPS en producción se maneja en CloudFront
};

export default nextConfig;
```

### 3.4 Configurar `tsconfig.json`

Verificar que incluya (debería venir de create-next-app, ajustar si falta):

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 3.5 Configurar Tailwind CSS 4

Tailwind CSS 4 usa un modelo basado en CSS. Verificar `src/app/globals.css`:

```css
@import 'tailwindcss';

/* === NexoERP Design Tokens === */

@theme {
  /* Colores primarios (indigo) */
  --color-primary-50: #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-200: #c7d2fe;
  --color-primary-300: #a5b4fc;
  --color-primary-400: #818cf8;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  --color-primary-700: #4338ca;
  --color-primary-800: #3730a3;
  --color-primary-900: #312e81;
  --color-primary-950: #1e1b4e;

  /* Colores semánticos */
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-info: #2563eb;

  /* Colores de estado de facturas */
  --color-draft: #6b7280;
  --color-published: #2563eb;
  --color-paid: #16a34a;
  --color-overdue: #dc2626;
  --color-cancelled: #9ca3af;

  /* Tipografía */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Espaciado base */
  --spacing-base: 4px;

  /* Border radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}

/* === Base styles === */

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 238.7 83.5% 66.7%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 238.7 83.5% 66.7%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 238.7 83.5% 66.7%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 238.7 83.5% 66.7%;
  }
}
```

### 3.6 Estructura de directorios base

Crear la estructura de carpetas del proyecto:

```powershell
# Crear estructura de directorios (src/ ya existe de create-next-app)
New-Item -ItemType Directory -Path "src/app/(auth)" -Force
New-Item -ItemType Directory -Path "src/app/(dashboard)" -Force
New-Item -ItemType Directory -Path "src/app/api" -Force
New-Item -ItemType Directory -Path "src/components/ui" -Force
New-Item -ItemType Directory -Path "src/components/layout" -Force
New-Item -ItemType Directory -Path "src/components/shared" -Force
New-Item -ItemType Directory -Path "src/lib/db" -Force
New-Item -ItemType Directory -Path "src/lib/utils" -Force
New-Item -ItemType Directory -Path "src/lib/validations" -Force
New-Item -ItemType Directory -Path "src/hooks" -Force
New-Item -ItemType Directory -Path "src/types" -Force
New-Item -ItemType Directory -Path "src/constants" -Force
New-Item -ItemType Directory -Path "src/__tests__" -Force
New-Item -ItemType Directory -Path "tests/e2e" -Force
New-Item -ItemType Directory -Path "docs/adr" -Force
New-Item -ItemType Directory -Path "docs/specs" -Force
```

### 3.7 Archivo de constantes base

```typescript
// src/constants/app.ts
export const APP_NAME = 'NexoERP';
export const APP_DESCRIPTION = 'Sistema ERP modular para PYMEs hondureñas';
export const APP_VERSION = '0.0.0';

export const LOCALES = {
  DEFAULT: 'es-HN',
  SUPPORTED: ['es-HN'] as const,
} as const;

export const CURRENCIES = {
  BASE: 'HNL',
  SUPPORTED: ['HNL', 'USD'] as const,
} as const;

export const ROLES = {
  ADMIN: 'administrador',
  MANAGER: 'gerente',
  ACCOUNTANT: 'contador',
  SALESPERSON: 'vendedor',
  AUDITOR: 'auditor',
} as const;

export const MODULES = {
  CORE: 'core',
  CONTACTS: 'contacts',
  ACCOUNTING: 'accounting',
  INVOICING: 'invoicing',
  PURCHASING: 'purchasing',
  SALES: 'sales',
  INVENTORY: 'inventory',
} as const;
```

### 3.8 Layout raíz

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'NexoERP',
    template: '%s | NexoERP',
  },
  description: 'Sistema ERP modular para PYMEs hondureñas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

### 3.9 Página raíz temporal

```tsx
// src/app/page.tsx
import { APP_NAME, APP_VERSION } from '@/constants/app';

export default function HomePage() {
  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-primary-600 text-4xl font-bold">{APP_NAME}</h1>
        <p className="text-muted-foreground mt-2">Sistema ERP modular para PYMEs hondureñas</p>
        <p className="text-muted-foreground mt-4 font-mono text-sm">
          v{APP_VERSION} — Fase 0: Fundación
        </p>
      </div>
    </main>
  );
}
```

### 3.10 Archivo `.env.example`

```env
# === NexoERP — Variables de Entorno ===
# Copiar este archivo como .env.local para desarrollo

# --- Base de datos ---
DATABASE_URL="postgresql://nexoerp:nexoerp_dev_2026@localhost:5432/nexoerp"
DIRECT_URL="postgresql://nexoerp:nexoerp_dev_2026@localhost:5432/nexoerp"

# --- Aplicación ---
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="NexoERP"

# --- AWS ---
AWS_REGION="us-east-1"

# --- Email (SES) ---
SES_FROM_EMAIL="no-reply@nexoerp.com"

# --- Storage (S3) ---
S3_BUCKET_DOCUMENTS="nexoerp-documents"

# --- Monitoring (opcional en dev) ---
SENTRY_DSN=""
```

### 3.11 Copiar `.env.example` a `.env.local`

```powershell
Copy-Item .env.example .env.local
```

### 3.12 Verificar `.gitignore`

Asegurar que `.gitignore` (generado por create-next-app) incluya:

```gitignore
# dependencies
/node_modules

# next.js
/.next/
/out/

# environment
.env
.env.local
.env.*.local

# misc
.DS_Store
*.pem
*.tsbuildinfo
next-env.d.ts

# prisma
prisma/generated/

# amplify
amplify_outputs.json
.amplify/

# IDE
.idea/
.vscode/settings.json

# OS
Thumbs.db
```

### 3.13 Instalar dependencias base de la capa UI

```powershell
# Utilidades y state management
npm install zustand@5 @tanstack/react-query@5 react-hook-form@7 zod@3 date-fns nuqs sonner

# Estas se instalarán más adelante conforme se necesiten:
# @tanstack/react-table, recharts, dnd-kit, cmdk (en Fase 1+)
```

### 3.14 Inicializar shadcn/ui

```powershell
npx shadcn@latest init
```

**Opciones del wizard:**

- Style: **New York**
- Base color: **Neutral** (luego personalizamos con indigo)
- CSS variables: **Yes**
- Import alias para components: **@/components**
- Import alias para utils: **@/lib/utils**
- React Server Components: **Yes**

Instalar componentes iniciales:

```powershell
npx shadcn@latest add button card input label badge separator skeleton toast
```

### 3.15 Verificar que todo compila

```powershell
# Type check
npx tsc --noEmit

# Build
npm run build

# Dev server
npm run dev
```

Abrir `http://localhost:3000` y verificar que se muestra la página con "NexoERP".

---

## 4. Estructura Resultante

```
src/
├── app/
│   ├── (auth)/                 # Route group para páginas de auth
│   ├── (dashboard)/            # Route group para páginas protegidas
│   ├── api/                    # API Route Handlers
│   ├── globals.css             # Tailwind + Design tokens
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Página raíz
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── layout/                 # Header, Sidebar, etc.
│   └── shared/                 # Componentes compartidos
├── lib/
│   ├── db/                     # Prisma client (F0-03)
│   ├── utils/                  # Utilidades (cn, formatters)
│   └── validations/            # Schemas Zod compartidos
├── hooks/                      # Custom React hooks
├── types/                      # TypeScript types/interfaces
├── constants/                  # Constantes de la app
│   └── app.ts
└── __tests__/                  # Tests unitarios
```

---

## 5. Criterios de Aceptación

| #   | Criterio                                                          | Verificación                                    |
| --- | ----------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Next.js 15.x instalado con App Router                             | `npx next --version` → 15.x                     |
| 2   | React 19.x                                                        | `package.json` dependencies                     |
| 3   | TypeScript 5.x en strict mode                                     | `tsconfig.json` → `"strict": true`              |
| 4   | Tailwind CSS 4.x con design tokens de NexoERP                     | `globals.css` tiene `@theme` con colores indigo |
| 5   | shadcn/ui inicializado con componentes base                       | Directorio `src/components/ui/` con archivos    |
| 6   | `npm run dev` levanta en `localhost:3000` sin errores             | Verificación visual                             |
| 7   | `npm run build` compila sin errores                               | Exit code 0                                     |
| 8   | `npx tsc --noEmit` sin errores de tipos                           | Exit code 0                                     |
| 9   | Estructura de directorios creada según spec                       | Todos los directorios existen                   |
| 10  | `.env.example` y `.env.local` configurados                        | Archivos existen con variables documentadas     |
| 11  | `.gitignore` incluye todas las exclusiones necesarias             | Verificar contenido                             |
| 12  | Dependencias base instaladas (zustand, tanstack-query, zod, etc.) | `package.json`                                  |

---

## 6. Checklist de Verificación

```
□ Node.js 20.x y npm 10.x verificados
□ create-next-app ejecutado con opciones correctas
□ next.config.ts configurado con headers de seguridad
□ tsconfig.json verificado (strict, paths, plugins)
□ globals.css con design tokens de NexoERP
□ Estructura de directorios creada
□ constants/app.ts con constantes del proyecto
□ layout.tsx con fuentes Inter + JetBrains Mono
□ page.tsx con contenido temporal
□ .env.example creado con todas las variables
□ .env.local copiado de .env.example
□ .gitignore verificado
□ shadcn/ui inicializado con componentes base
□ Dependencias base instaladas
□ npm run dev funciona
□ npm run build compila sin errores
□ tsc --noEmit sin errores
```

---

## 7. Notas Técnicas

- **Tailwind CSS 4** cambia significativamente la configuración respecto a v3. Ya no se usa `tailwind.config.ts` de la misma forma; la configuración es CSS-first con `@theme`.
- **Next.js 15** con App Router usa Server Components por defecto. Marcar explícitamente `'use client'` cuando se necesiten hooks o interactividad.
- **Turbopack** es el bundler por defecto en dev. Si hay issues, se puede desactivar quitando `--turbopack`.
- El import alias `@/*` mapea a `./src/*` para imports limpios.
- **No instalar** todavía: TanStack Table, Recharts, dnd-kit, cmdk — se instalarán conforme se necesiten en fases posteriores.
