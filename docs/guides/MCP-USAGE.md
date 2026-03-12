# Uso de MCP Servers — NexoERP

## ¿Qué son los MCP Servers?

Los **MCP (Model Context Protocol) Servers** son servicios que proveen contexto especializado a agentes IA (GitHub Copilot, Claude, etc.), permitiéndoles interactuar con herramientas externas y acceder a documentación actualizada.

En NexoERP, los MCPs potencian el flujo de trabajo de desarrollo al:

- 🐙 Gestionar Issues y Pull Requests desde la conversación con el agente
- 📚 Acceder a documentación actualizada de Next.js 15, Prisma 6, AWS Amplify Gen 2
- 🧠 Razonar paso a paso en decisiones arquitectónicas complejas
- 🐘 Inspeccionar la base de datos y verificar políticas RLS (Fase 1+)

---

## MCPs Configurados

### 🐙 GitHub MCP

**Propósito:** Gestión de repositorio, Issues, Pull Requests, búsqueda de código.

**Cuándo usarlo:**

- Crear issues para tareas identificadas
- Revisar PRs y sugerir mejoras
- Buscar código en el repositorio
- Consultar historial de commits
- Gestionar labels y milestones

**Ejemplos de prompts:**

```
"Crea un issue para implementar la validación de CAI en el módulo de facturación"

"Revisa el PR #15 y sugiere mejoras de seguridad"

"Busca todos los archivos que usan company_id para verificar el aislamiento multi-tenant"

"Lista los últimos 5 commits en la rama main"
```

**Configuración requerida:**

- Variable de entorno `GITHUB_TOKEN` debe estar configurada
- Token debe tener permisos: `repo`, `read:project`, `write:org` (o equivalentes fine-grained)

---

### 📚 Context7 MCP

**Propósito:** Provee documentación actualizada de las librerías del stack tecnológico.

**Librerías indexadas:**
| Librería | Versión | Uso en NexoERP |
|----------|---------|----------------|
| Next.js | 15.x | App Router, API Routes, RSC, middleware |
| React | 19.x | Hooks, Server Components, Suspense |
| Prisma | 6.x | Schema, Client, Migrations, Extensions |
| AWS Amplify | Gen 2 | Auth (Cognito), Storage (S3), Backend |
| Tailwind CSS | 4.x | Utility classes, @theme configuration |
| Zod | 3.x | Schema validation front/back |
| TanStack Query | 5.x | Server state, mutations, caching |
| React Hook Form | 7.x | Form handling, validation |
| Vitest | Latest | Unit testing, mocking |
| Playwright | Latest | E2E testing |

**Cuándo usarlo:**

- Implementar features con API actualizada
- Verificar sintaxis correcta de librerías
- Consultar mejores prácticas documentadas
- Resolver dudas sobre nuevas versiones

**Ejemplos de prompts:**

```
"Usando Context7, muéstrame cómo crear un middleware en Next.js 15 para extraer company_id del JWT"

"¿Cómo funciona prismaSchemaFolder en Prisma 6 para schemas multi-archivo?"

"Dame la API actualizada de TanStack Query 5 para mutations con optimistic updates"

"Usando Context7, ¿cómo configuro AWS Amplify Gen 2 para usar custom attributes en Cognito?"
```

**Ventajas:**

- ✅ No requiere API key ni configuración adicional
- ✅ Documentación siempre actualizada (no como StackOverflow)
- ✅ Gratuito y open source

---

### 🧠 Sequential Thinking MCP

**Propósito:** Razonamiento estructurado paso a paso para decisiones complejas de arquitectura.

**Cuándo usarlo:**

- Diseñar schemas de base de datos nuevos
- Evaluar trade-offs entre opciones arquitectónicas
- Planificar migraciones de datos complejas
- Análisis de impacto de cambios mayores
- Debugging de problemas multi-capa

**Ejemplos de prompts:**

```
"Piensa paso a paso: ¿cómo debería diseñar el schema Prisma para el módulo de facturación con CAI, numeración SAR e ISV?"

"Analiza el impacto de agregar soporte multimoneda al módulo de contabilidad. Considera RLS, índices y performance."

"Evalúa estos 3 enfoques para implementar auditoría inmutable: 1) trigger PostgreSQL, 2) Prisma middleware, 3) API layer. Razona pros/contras."

"Debugging paso a paso: las políticas RLS no están aislando correctamente los tenants. ¿Por qué?"
```

**Proceso típico:**

1. El agente descompone el problema en pasos
2. Analiza cada opción metódicamente
3. Identifica dependencias y consecuencias
4. Propone solución fundamentada

---

### 📋 Notion MCP (Opcional)

**Propósito:** Gestión de tareas y documentación de proyecto en Notion.

> ⚠️ **Nota:** Este MCP es opcional. Si se usa GitHub Projects, Linear u otra herramienta de PM, omitir.

**Cuándo usarlo:**

- Crear tareas durante conversaciones
- Actualizar estados de sprint
- Consultar roadmap o especificaciones
- Sincronizar decisiones técnicas con PM

**Configuración:**

1. Crear Integration en [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Copiar Internal Integration Token
3. Configurar variable de entorno `NOTION_API_KEY`
4. Compartir páginas/databases del proyecto con la integration

**Ejemplo de configuración en `.vscode/mcp.json`:**

```json
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

---

### 🐘 PostgreSQL MCP (Fase 1+)

**Propósito:** Inspección de schema, diagnóstico de queries, verificación de políticas RLS.

> 📌 **Estado:** Documentado para Fase 1. No configurar hasta que haya datos reales en la BD.

**Cuándo usarlo (Fase 1+):**

- Verificar políticas RLS por tabla
- Analizar planes de ejecución de queries lentas
- Inspeccionar índices y constraints
- Validar extensiones de PostgreSQL
- Debugging de aislamiento multi-tenant

**Ejemplos de prompts (futuro):**

```
"Lista todas las políticas RLS de la tabla invoices y verifica que filtran por company_id"

"Muéstrame el plan de ejecución EXPLAIN ANALYZE de la query del libro de ventas"

"Verifica que las extensiones uuid-ossp y pgcrypto están instaladas"

"Lista todas las tablas que NO tienen company_id (excepto companies y users)"
```

**Configuración (futura):**

```json
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

---

## Configuración

### Archivo de Configuración

Los MCPs se configuran en `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "github": { ... },
    "context7": { ... },
    "sequential-thinking": { ... }
  }
}
```

### Variables de Entorno

Los tokens se almacenan como **variables de entorno del sistema** (nunca en archivos `.env` o tracked en Git).

**Configurar en PowerShell (Windows):**

```powershell
# Opción 1: Variable de sesión (temporal)
$env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxx"

# Opción 2: Variable persistente de usuario (recomendado)
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "ghp_xxxxxxxxxxxx", "User")

# Verificar
echo $env:GITHUB_TOKEN
```

**Configurar en Bash (Linux/macOS):**

```bash
# Agregar a ~/.bashrc o ~/.zshrc
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"

# Aplicar cambios
source ~/.bashrc

# Verificar
echo $GITHUB_TOKEN
```

**Obtener GITHUB_TOKEN:**

```powershell
# Opción A: Usar token de GitHub CLI (recomendado)
gh auth token

# Opción B: Crear Personal Access Token
# 1. github.com → Settings → Developer Settings → Personal Access Tokens
# 2. Fine-grained tokens → Generate new token
# 3. Permisos: repo, read:project, write:org
# 4. Expiration: 90 días o sin expiración (para dev local)
```

---

## Troubleshooting

| Problema                                | Causa Probable                       | Solución                                     |
| --------------------------------------- | ------------------------------------ | -------------------------------------------- |
| **MCP no responde**                     | `npx` no funciona                    | Verificar Node.js: `npx --version`           |
| **GitHub MCP: 401 Unauthorized**        | Token expirado o inválido            | Regenerar token: `gh auth refresh`           |
| **Context7: timeout**                   | Servicio temporalmente no disponible | Reiniciar VS Code, esperar 1-2 min           |
| **Notion: 403 Forbidden**               | Página no compartida con integration | Compartir página en Notion con la app        |
| **Variable de entorno no se encuentra** | No configurada correctamente         | Reiniciar terminal/IDE después de configurar |
| **MCP se queda "cargando"**             | Proceso Node.js colgado              | Matar proceso `npx` y reintentar             |

**Logs de debug:**

Si un MCP falla, verificar manualmente:

```powershell
# Probar que el MCP responde
npx -y @modelcontextprotocol/server-github --help

# Ver versión instalada
npx -y @upstash/context7-mcp@latest --version

# Ver logs de VS Code
# View → Output → Select "MCP Servers" en el dropdown
```

---

## Buenas Prácticas

### ✅ DO

- **Usar variables de entorno** para tokens (nunca hardcodear)
- **Actualizar MCPs regularmente** (npx -y siempre instala la última versión)
- **Especificar contexto en prompts:** "Usando Context7, ..." o "Piensa paso a paso..."
- **Verificar permisos del token GitHub** (no dar más permisos de los necesarios)
- **Compartir solo las páginas necesarias** en Notion (principio de menor privilegio)

### ❌ DON'T

- **NO commitear tokens** en `.vscode/mcp.json` (usar sintaxis `${env:VAR}`)
- **NO usar tokens con scope `admin`** para MCPs (solo `repo` + `read:project`)
- **NO compartir GITHUB_TOKEN** entre desarrolladores (cada dev debe tener su propio token)
- **NO ejecutar MCPs con permisos de root** (corren como usuario normal)
- **NO usar MCP de PostgreSQL en producción** (solo desarrollo/staging)

---

## Referencias

- [Model Context Protocol — Specification](https://modelcontextprotocol.io/)
- [GitHub MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/github)
- [Context7 Documentation](https://upstash.com/docs/context7)
- [Notion MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/notion)
- [Sequential Thinking MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking)

---

## Actualizaciones

- **12 marzo 2026:** Configuración inicial de GitHub, Context7 y Sequential Thinking MCPs (F0-09)
- **Fase 1:** Se agregará PostgreSQL MCP cuando haya datos reales en la BD
