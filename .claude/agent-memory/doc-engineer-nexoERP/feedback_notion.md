---
name: Comportamiento MCP Notion en este entorno
description: El servidor MCP de Notion devuelve not_found_error en todas las llamadas en este entorno
type: feedback
---

El MCP de Notion (`mcp__claude_ai_Notion__notion-search`, `notion-create-pages`, etc.)
devuelve `not_found_error: Server not found` en todas las llamadas desde este entorno.

**Why:** La integracion Notion MCP no esta configurada o activa en la sesion actual de
Claude Code en este equipo.

**How to apply:** Cuando el usuario pida actualizar Notion, intentar las llamadas MCP
primero. Si fallan con not_found_error, crear el documento como archivo Markdown en
`docs/NOTION-TEMPLATE-*.md` con instrucciones claras para copiar/importar manualmente.
No bloquear la tarea — entregar el contenido listo para pegar.
