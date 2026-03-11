# Guía de Configuración de GitHub para NexoERP

Este documento contiene las instrucciones para crear el repositorio en GitHub y conectar el proyecto local.

## Estado Actual

✅ **Completado:**

- Repositorio Git inicializado localmente
- Dos commits creados:
  1. `feat: initial Next.js 15 project setup (F0-01)`
  2. `feat(tooling): add Changesets for changelog and version management`
- Branches creadas: `main` y `staging` (sincronizadas)
- Sistema de changelog con Changesets configurado

## Pasos para Crear el Repositorio en GitHub

### 1. Crear Repositorio en GitHub

1. Ve a [github.com/new](https://github.com/new)
2. Configura el repositorio:
   - **Repository name:** `nexo-ERP`
   - **Description:** `Sistema ERP modular multi-tenant para PYMEs hondureñas con cumplimiento fiscal SAR y contabilidad NIIF`
   - **Visibility:** 🔒 **Private** (proyecto empresarial)
   - **⚠️ NO marcar:** "Add a README file" (ya existe localmente)
   - **⚠️ NO marcar:** "Add .gitignore" (ya existe localmente)
   - **⚠️ NO marcar:** "Choose a license" (se agregará después)
3. Click en **"Create repository"**

### 2. Conectar Repositorio Local con GitHub

GitHub te mostrará una página con instrucciones. Usa estos comandos (reemplaza `{TU-USUARIO}` con tu username de GitHub):

```powershell
# Agregar remote
git remote add origin https://github.com/{TU-USUARIO}/nexo-ERP.git

# Verificar remote
git remote -v

# Push de main branch
git push -u origin main

# Push de staging branch
git push -u origin staging
```

### 3. Verificar Branches en GitHub

Después del push, verifica en GitHub:

- Ve a `https://github.com/{TU-USUARIO}/nexo-ERP`
- Deberías ver 2 branches: `main` y `staging`
- Ambas deben tener 2 commits

### 4. Configurar Branch Protection (Opcional - Recomendado)

**Para `main` branch:**

1. Ve a Settings → Branches
2. Click "Add branch protection rule"
3. Branch name pattern: `main`
4. Activa:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging (cuando tengas CI)
   - ✅ Require conversation resolution before merging
5. Save changes

**Para `staging` branch:**

- Repetir con configuración similar pero menos restrictiva

## Sistema de Changelog con Changesets

### ¿Qué es Changesets?

Changesets es un sistema para gestionar versiones y generar changelogs automáticamente siguiendo versionado semántico.

### Comandos Disponibles

```bash
# Crear un changeset (registrar cambio)
npm run changeset

# Aplicar changesets y actualizar versiones
npm run version

# Publicar cambios (si aplica)
npm run release
```

### Flujo de Trabajo

1. **Al terminar una feature:**

   ```bash
   npm run changeset
   ```

   - Te preguntará qué tipo de cambio es (major/minor/patch)
   - Te pedirá una descripción del cambio
   - Creará un archivo en `.changeset/` con el cambio registrado

2. **Al hacer release (merge a main):**

   ```bash
   npm run version
   ```

   - Lee todos los changesets
   - Actualiza `package.json` con nueva versión
   - Genera/actualiza `CHANGELOG.md`
   - Elimina los changesets aplicados

3. **Commit y push:**
   ```bash
   git add .
   git commit -m "chore: version bump and changelog"
   git push
   ```

### Tipos de Cambio (Versionado Semántico)

- **Major (1.0.0 → 2.0.0):** Breaking changes
- **Minor (1.0.0 → 1.1.0):** New features (backward compatible)
- **Patch (1.0.0 → 1.0.1):** Bug fixes

### Ejemplo de Uso

```bash
# Después de implementar F0-02 (Amplify Gen 2)
$ npm run changeset

🦋  What kind of change is this for nexoerp? (choose one)
→ minor

🦋  Please enter a summary for this change
→ Configuración de AWS Amplify Gen 2 con Cognito y S3

# Esto crea un archivo en .changeset/ que registra el cambio
# Al hacer release, se generará automáticamente la entrada en CHANGELOG.md
```

## Próximos Pasos

Una vez completada la configuración de GitHub:

1. ✅ Continuar con **F0-02: Amplify Gen 2** (Cognito + S3)
2. ✅ Implementar **F0-03: Prisma + PostgreSQL** (multi-file schema + RLS)
3. ✅ Configurar **F0-04: Tooling** (ESLint, Prettier, Husky, commitlint)
4. ✅ Setup **F0-05: Testing** (Vitest + Playwright)
5. ✅ Completar **F0-06: Repositorio** (GitHub Actions CI/CD)
6. ✅ Configurar **F0-07: Ambientes** (Docker, staging RDS, production)
7. ✅ Crear **F0-08: Documentación** (ARCHITECTURE.md, ADRs)
8. ✅ Configurar **F0-09: MCPs** (GitHub, Context7, Notion, Sequential Thinking)

## Referencias

- [Changesets Documentation](https://github.com/changesets/changesets)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

---

**Proyecto:** NexoERP v0.0.0 — Fase 0: Fundación  
**Documento creado:** 9 de marzo de 2026  
**Estado:** Setup inicial completado, listo para push a GitHub
