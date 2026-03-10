# F0-09: MCPs — Configurar GitHub, Context7, Notion, Sequential Thinking

> **ID:** F0-09
> **Fase:** 0 — Fundación
> **Prioridad:** 🟢 Media
> **Estimación:** 1–2 horas
> **Dependencias:** F0-06 (Repositorio GitHub)
> **Bloquea a:** Ninguno directo (mejora productividad de todas las fases)

---

## 1. Objetivo

Configurar los MCP Servers (Model Context Protocol) que potencian el flujo de trabajo con agentes IA durante el desarrollo. Estos servidores proveen contexto especializado a GitHub Copilot, Claude, y otros LLMs, mejorando significativamente la calidad del código generado y las decisiones arquitectónicas.

---

## 2. Mapa de MCPs por Fase

| MCP Server | Propósito | Fase |
|------------|----------|------|
| **GitHub MCP** | Gestión de repo, PRs, issues, code review | 0 ✅ |
| **Context7** | Documentación actualizada de Next.js 15, Prisma 6, Amplify Gen 2 | 0 ✅ |
| **Notion MCP** | Gestión de tareas, sprints, documentación de proyecto | 0 ✅ |
| **Sequential Thinking** | Razonamiento estructurado para decisiones de arquitectura | 0 ✅ |
| **PostgreSQL MCP** | Inspección de schema, queries de debug, verificar RLS | 1 (futuro) |
| **Figma MCP** | Extraer design tokens y specs de componentes | 2 (futuro) |

---

## 3. Prerrequisitos

| Requisito | Detalle | Verificación |
|-----------|---------|-------------|
| F0-06 completado | Repositorio GitHub creado | `gh repo view` |
| Node.js 20+ | Para MCP servers basados en Node | `node --version` |
| npx | Para ejecutar MCP servers | `npx --version` |
| VS Code | Con extensión GitHub Copilot | Copilot funcional |
| Cuenta Notion (opcional) | Para Notion MCP | Login en notion.so |
| Token GitHub | Personal Access Token (Classic o Fine-grained) | `gh auth status` |

---

## 4. Pasos de Implementación

### 4.1 Configuración Global de MCP Servers

Los MCP Servers se configuran en VS Code settings o en archivos de configuración del agente. Crear el archivo de configuración:

```jsonc
// .vscode/mcp.json
// Configuración de MCP Servers para NexoERP
{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_TOKEN}"
      }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

### 4.2 GitHub MCP Server

**Propósito:** Permite a los agentes IA interactuar directamente con el repositorio GitHub — crear issues, PRs, revisar código, buscar en el codebase.

**Configuración del token:**

```powershell
# Opción A: Usar token de GitHub CLI (recomendado)
$env:GITHUB_TOKEN = $(gh auth token)

# Opción B: Crear Personal Access Token (Fine-grained)
# 1. Ir a github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained
# 2. Crear token con permisos:
#    - Repository: nexoerp (o All repositories)
#    - Permissions:
#      - Contents: Read and write
#      - Issues: Read and write
#      - Pull Requests: Read and write
#      - Metadata: Read
# 3. Copiar token
```

**Agregar token a variables de entorno persistentes:**

```powershell
# PowerShell — Agregar a perfil de usuario
# Agregar a $PROFILE o en Variables de Entorno del sistema
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "<tu-token>", "User")
```

**Verificación:**

```powershell
# Probar que el MCP responde
npx -y @modelcontextprotocol/server-github --help
```

**Capacidades del GitHub MCP:**
- 🔍 Buscar código en el repositorio
- 📝 Crear y gestionar Issues
- 🔀 Crear y revisar Pull Requests
- 📂 Leer contenido de archivos
- 🏷️ Gestionar labels y milestones
- 👤 Consultar información del usuario

### 4.3 Context7 MCP Server

**Propósito:** Provee documentación actualizada de las librerías que usa NexoERP. Cuando un agente IA necesita saber cómo funciona la API de Prisma 6 o Next.js 15, Context7 provee la documentación correcta.

**Librerías principales indexadas en Context7:**

| Librería | Uso en NexoERP |
|----------|---------------|
| Next.js 15 | App Router, Route Handlers, RSC, middleware |
| React 19 | Hooks, Server Components, Suspense |
| Prisma 6 | Schema, Client, Migrations, Extensions |
| AWS Amplify Gen 2 | Auth, Storage, Backend |
| Tailwind CSS 4 | Utility classes, @theme |
| Zod 3 | Schema validation |
| TanStack Query 5 | Server state, mutations, caching |
| React Hook Form 7 | Form handling |
| Vitest | Testing, mocking |
| Playwright | E2E testing |

**No requiere configuración adicional** — Context7 se conecta automáticamente a su base de documentación.

**Verificación:**

```powershell
npx -y @upstash/context7-mcp@latest --help
```

**Uso típico:**
Cuando pides a un agente: *"Crea un middleware de Next.js 15 para resolver el tenant"*, Context7 provee la documentación actualizada de `middleware.ts` de Next.js 15 App Router, asegurando que el código generado use la API correcta.

### 4.4 Sequential Thinking MCP Server

**Propósito:** Proporciona razonamiento paso a paso para decisiones complejas de arquitectura. Permite a los agentes IA "pensar en voz alta" de manera estructurada antes de tomar decisiones.

**Casos de uso en NexoERP:**
- Diseñar el schema de un nuevo módulo
- Evaluar trade-offs de arquitectura
- Planificar migraciones de datos
- Análisis de impacto de cambios
- Resolución de bugs complejos multi-capa

**No requiere configuración adicional.**

**Verificación:**

```powershell
npx -y @modelcontextprotocol/server-sequential-thinking --help
```

### 4.5 Notion MCP Server (Opcional)

**Propósito:** Permite a los agentes IA interactuar con el workspace de Notion para gestión de proyecto — crear tareas, actualizar sprints, consultar documentación.

> ⚠️ **Nota:** Notion MCP es opcional. Si se usa otra herramienta de project management (GitHub Projects, Linear, Jira), omitir este paso.

**Configuración:**

1. **Crear Integration en Notion:**
   - Ir a [notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Crear nueva integración "NexoERP Dev"
   - Copiar el Internal Integration Token

2. **Agregar a mcp.json:**

```jsonc
// Agregar a .vscode/mcp.json → servers
{
  "notion": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-notion"],
    "env": {
      "NOTION_API_KEY": "${env:NOTION_API_KEY}"
    }
  }
}
```

3. **Configurar token:**

```powershell
[Environment]::SetEnvironmentVariable("NOTION_API_KEY", "<notion-token>", "User")
```

4. **Compartir páginas con la integration:**
   - En Notion, ir a la página/database del proyecto
   - Click "..." → "Connections" → Agregar "NexoERP Dev"

### 4.6 PostgreSQL MCP Server (Fase 1 — Documentar para futuro)

> 📌 **No configurar ahora.** Documentar para cuando se implemente en Fase 1.

**Propósito:** Permite a los agentes inspeccionar el schema de la BD, ejecutar queries de diagnóstico, verificar políticas RLS.

```jsonc
// Para Fase 1: Agregar a .vscode/mcp.json → servers
{
  "postgres": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres"],
    "env": {
      "POSTGRES_CONNECTION_STRING": "${env:DATABASE_URL}"
    }
  }
}
```

### 4.7 Documentar uso de MCPs para el equipo

Crear archivo de referencia:

```markdown
<!-- docs/guides/MCP-USAGE.md -->
# Uso de MCP Servers — NexoERP

## ¿Qué son los MCP Servers?

Los MCP (Model Context Protocol) Servers son servicios que proveen contexto especializado a agentes IA (GitHub Copilot, Claude, etc.), permitiéndoles interactuar con herramientas externas y acceder a documentación actualizada.

## MCPs Configurados

### 🐙 GitHub MCP
**Cuándo usarlo:** Gestión de Issues, PRs, búsqueda de código.

Ejemplos de prompts:
- "Crea un issue para implementar la validación de CAI"
- "Revisa el PR #15 y sugiere mejoras"
- "Busca todos los archivos que usan `company_id`"

### 📚 Context7
**Cuándo usarlo:** Cuando necesitas documentación actualizada de librerías.

Ejemplos de prompts:
- "Usando Context7, muéstrame cómo crear un middleware en Next.js 15"
- "¿Cómo funciona prismaSchemaFolder en Prisma 6?"
- "Dame la API actualizada de TanStack Query 5 para mutations"

### 🧠 Sequential Thinking
**Cuándo usarlo:** Decisiones de arquitectura complejas, diseño de schema.

Ejemplos de prompts:
- "Piensa paso a paso: ¿cómo debería diseñar el schema de facturación?"
- "Analiza el impacto de agregar soporte multimoneda al módulo de contabilidad"
- "Evalúa trade-offs entre estas 3 opciones de implementación"

### 📋 Notion (Opcional)
**Cuándo usarlo:** Gestión de tareas y documentación de proyecto.

Ejemplos de prompts:
- "Crea una tarea en Notion para el sprint actual"
- "Actualiza el estado de la tarea F1-03"

### 🐘 PostgreSQL (Fase 1+)
**Cuándo usarlo:** Debugging de BD, verificación de RLS.

Ejemplos de prompts:
- "Lista todas las políticas RLS de la tabla users"
- "Muéstrame el plan de ejecución de esta query"
- "Verifica que las extensiones uuid-ossp y pgcrypto están instaladas"

## Configuración

Los MCPs se configuran en `.vscode/mcp.json`. Los tokens se almacenan como variables de entorno del sistema (nunca en archivos del proyecto).

## Troubleshooting

| Problema | Solución |
|----------|----------|
| MCP no responde | Verificar que `npx` funciona: `npx --version` |
| GitHub MCP: 401 | Token expirado, regenerar: `gh auth refresh` |
| Context7: timeout | Reiniciar VS Code |
| Notion: 403 | Verificar que la página está compartida con la integration |
```

---

## 5. Estructura Resultante

```
.vscode/
├── mcp.json                          # Configuración MCP Servers
├── settings.json                     # (ya existente de F0-04)
└── extensions.json                   # (ya existente de F0-04)
docs/
└── guides/
    ├── CONTRIBUTING.md               # (ya existente de F0-08)
    └── MCP-USAGE.md                  # Guía de uso de MCPs
```

---

## 6. Criterios de Aceptación

| # | Criterio | Verificación |
|---|----------|-------------|
| 1 | `.vscode/mcp.json` creado con 3-4 MCPs | Archivo existe y es JSON válido |
| 2 | GitHub MCP funcional | Agente puede listar issues/PRs |
| 3 | Context7 MCP funcional | Agente responde con docs actualizados |
| 4 | Sequential Thinking MCP funcional | Agente razona paso a paso |
| 5 | `GITHUB_TOKEN` configurado en env vars | `echo $env:GITHUB_TOKEN` no es vacío |
| 6 | Guía `MCP-USAGE.md` creada | Archivo existe con ejemplos |
| 7 | PostgreSQL MCP documentado para Fase 1 | Mencionado en guía |
| 8 | Tokens NO están en archivos del proyecto | `grep` no encuentra tokens en tracked files |

---

## 7. Checklist de Verificación

```
□ .vscode/mcp.json creado
□ GitHub MCP configurado con token
□ Context7 MCP configurado
□ Sequential Thinking MCP configurado
□ Notion MCP configurado (opcional)
□ GITHUB_TOKEN en variables de entorno del sistema
□ NOTION_API_KEY en variables de entorno (si aplica)
□ docs/guides/MCP-USAGE.md creado
□ Los MCPs no exponen tokens en archivos tracked
□ Todos los MCPs responden (verificar con --help)
□ Al menos un prompt de prueba exitoso con cada MCP
```

---

## 8. Notas Técnicas

- **MCP Servers corren localmente:** Se ejecutan como procesos Node.js en la máquina del desarrollador. No consumen recursos de AWS ni tienen costo.
- **Tokens en `${env:VAR}`:** La sintaxis `${env:GITHUB_TOKEN}` en `mcp.json` referencia variables de entorno del sistema, no archivos `.env`. Esto evita comprometer tokens en Git.
- **Context7 es gratuito:** No requiere API key ni cuenta. Provee documentación de librerías open source.
- **Sequential Thinking es stateless:** Cada invocación empieza desde cero. No recuerda conversaciones anteriores.
- **PostgreSQL MCP (Fase 1):** Se configura cuando hay datos reales en la BD. En Fase 0 no hay tablas con datos significativos.
- **Actualizaciones:** Los MCP servers se actualizan automáticamente con `npx -y` (descarga la última versión). No requieren maintenance.
