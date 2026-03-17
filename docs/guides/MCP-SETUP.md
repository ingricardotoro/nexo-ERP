# Setup de MCPs — Inicio Rápido

## 1. Configurar GITHUB_TOKEN (Obligatorio)

El GitHub MCP requiere un Personal Access Token para funcionar.

### Opción A: Instalar GitHub CLI (Recomendado)

```powershell
# Instalar GitHub CLI
winget install GitHub.cli

# Autenticarse
gh auth login

# Configurar variable de entorno
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", (gh auth token), "User")
```

### Opción B: Crear token manualmente

1. Ir a: https://github.com/settings/tokens
2. Click "Generate new token" → "Fine-grained tokens"
3. Configurar:
   - **Name:** NexoERP Dev
   - **Expiration:** 90 días (o sin expiración)
   - **Repository access:** Only select repositories → `nexo-ERP`
   - **Permissions:**
     - Contents: Read and write
     - Issues: Read and write
     - Pull requests: Read and write
     - Metadata: Read (automático)
4. Click "Generate token" y copiar

5. Configurar en PowerShell:

```powershell
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "ghp_xxxxxxxxxxxx", "User")
```

6. **Reiniciar VS Code** para que cargue la nueva variable de entorno

---

## 2. Verificar configuración

```powershell
# Verificar que el token esté configurado
echo $env:GITHUB_TOKEN

# Probar Context7 MCP
npx -y @upstash/context7-mcp@latest --help

# Probar Sequential Thinking MCP
npx -y @modelcontextprotocol/server-sequential-thinking --help
```

Si ves la ayuda de cada comando, los MCPs están listos. ✅

---

## 3. Usar los MCPs

Una vez configurados, puedes usar los MCPs en conversaciones con agentes IA:

```
"Crea un issue para implementar validación de CAI"

"Usando Context7, muéstrame cómo crear un middleware en Next.js 15"

"Piensa paso a paso: ¿cómo diseñar el schema del módulo de facturación?"
```

Para más detalles, consulta: [docs/guides/MCP-USAGE.md](../guides/MCP-USAGE.md)

---

## Troubleshooting

**GITHUB_TOKEN no se reconoce después de configurarlo:**

- Reinicia VS Code completamente (cerrar todas las ventanas)
- Verifica con `echo $env:GITHUB_TOKEN` en nueva terminal

**npx: command not found:**

- Verifica Node.js: `node --version`
- Reinstala Node.js desde: https://nodejs.org/

**GitHub MCP: 401 Unauthorized:**

- Verifica que el token tiene los permisos correctos
- Genera un nuevo token si expiró

---

_Última actualización: 12 marzo 2026_
