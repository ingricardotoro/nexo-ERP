# F0-04: Tooling — ESLint, Prettier, Husky, commitlint, Changesets

> **ID:** F0-04
> **Fase:** 0 — Fundación
> **Prioridad:** 🟡 Alta
> **Estimación:** 2–3 horas
> **Dependencias:** F0-01 (Setup proyecto)
> **Bloquea a:** F0-05 (Testing), F0-06 (Repositorio)

---

## 1. Objetivo

Configurar todas las herramientas de calidad de código, formateo, git hooks y gestión de versiones para garantizar consistencia y estándares profesionales desde el primer commit del proyecto.

---

## 2. Prerrequisitos

| Requisito        | Detalle                       | Verificación           |
| ---------------- | ----------------------------- | ---------------------- |
| F0-01 completado | Proyecto Next.js 15 funcional | `npm run dev` funciona |
| Git inicializado | Repositorio git local         | `git status` funciona  |

---

## 3. Pasos de Implementación

### 3.1 ESLint (ya viene con Next.js, extender)

Next.js 15 incluye ESLint base. Extender con reglas adicionales:

```powershell
# Instalar plugins adicionales
npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-import eslint-plugin-jsx-a11y eslint-plugin-react-hooks eslint-plugin-tailwindcss
```

Crear/actualizar configuración de ESLint:

```javascript
// eslint.config.mjs
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:tailwindcss/recommended',
    'prettier', // Debe ser el último para override de reglas de formato
  ),
  {
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],

      // React
      'react/no-unescaped-entities': 'off',

      // Import order
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // Accesibilidad
      'jsx-a11y/anchor-is-valid': 'off', // Next.js Link component

      // Tailwind
      'tailwindcss/no-custom-classname': 'off', // Permitir custom classes
    },
  },
  {
    // Ignorar archivos generados
    ignores: [
      'node_modules/',
      '.next/',
      'out/',
      'prisma/generated/',
      'amplify_outputs.json',
      '.amplify/',
    ],
  },
];

export default eslintConfig;
```

Instalar eslint-config-prettier:

```powershell
npm install --save-dev eslint-config-prettier
```

### 3.2 Prettier

```powershell
npm install --save-dev prettier prettier-plugin-tailwindcss
```

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

```gitignore
# .prettierignore
node_modules/
.next/
out/
prisma/migrations/
amplify_outputs.json
.amplify/
pnpm-lock.yaml
package-lock.json
```

### 3.3 Scripts de lint y format en `package.json`

```json
{
  "scripts": {
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit"
  }
}
```

### 3.4 Husky (Git Hooks)

```powershell
# Instalar Husky
npm install --save-dev husky

# Inicializar Husky
npx husky init
```

Esto crea `.husky/` con un hook `pre-commit` base.

Editar `.husky/pre-commit`:

```bash
#!/usr/bin/env sh

# NexoERP — Pre-commit hook
# Ejecuta lint-staged para verificar solo archivos staged

npx lint-staged
```

### 3.5 lint-staged

```powershell
npm install --save-dev lint-staged
```

Agregar configuración en `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml,css}": ["prettier --write"],
    "*.prisma": ["prettier --write"]
  }
}
```

### 3.6 commitlint

```powershell
# Instalar commitlint
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

```javascript
// commitlint.config.mjs
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Tipos permitidos
    'type-enum': [
      2,
      'always',
      [
        'feat', // Nueva funcionalidad
        'fix', // Corrección de bug
        'docs', // Documentación
        'style', // Formato (no afecta lógica)
        'refactor', // Refactorización
        'perf', // Mejora de rendimiento
        'test', // Tests
        'chore', // Tareas de mantenimiento
        'ci', // CI/CD
        'build', // Build system
        'revert', // Revert de commit
      ],
    ],
    // Scopes permitidos (módulos de NexoERP)
    'scope-enum': [
      2,
      'always',
      [
        'core', // Módulo core
        'auth', // Autenticación
        'contacts', // Módulo contactos
        'accounting', // Módulo contabilidad
        'invoicing', // Módulo facturación
        'purchasing', // Módulo compras
        'sales', // Módulo ventas/CRM
        'inventory', // Módulo inventarios
        'ui', // Componentes UI
        'db', // Base de datos / Prisma
        'infra', // Infraestructura / AWS
        'api', // API routes
        'deps', // Dependencias
        'config', // Configuración
      ],
    ],
    'scope-empty': [1, 'never'], // Warning si no hay scope
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'body-max-line-length': [0, 'always', Infinity], // Sin límite en body
  },
};
```

Crear hook de commit-msg:

```powershell
# Crear hook para commitlint
echo 'npx --no -- commitlint --edit $1' > .husky/commit-msg
```

### 3.7 Changesets (Gestión de versiones y changelog)

```powershell
# Instalar Changesets
npm install --save-dev @changesets/cli

# Inicializar
npx changeset init
```

Configurar `.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### 3.8 EditorConfig

```ini
# .editorconfig
# https://editorconfig.org

root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.prisma]
indent_size = 2

[Makefile]
indent_style = tab
```

### 3.9 VS Code settings recomendadas

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "Prisma.prisma",
    "ms-azuretools.vscode-docker",
    "github.copilot",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

```json
// .vscode/settings.json (commitear esta versión)
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "tailwindCSS.experimental.classRegex": [["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

### 3.10 Verificar todo funciona

```powershell
# Lint
npm run lint

# Format check
npm run format:check

# Typecheck
npm run typecheck

# Probar hook de commit
git add .
git commit -m "chore(config): initial project setup with tooling"
# Debe pasar commitlint y lint-staged

# Probar commit inválido
git commit -m "invalid message"
# Debe fallar con error de commitlint
```

---

## 4. Estructura Resultante

```
.husky/
├── pre-commit              # Ejecuta lint-staged
└── commit-msg              # Ejecuta commitlint

.changeset/
└── config.json             # Configuración de Changesets

.vscode/
├── extensions.json         # Extensiones recomendadas
└── settings.json           # Configuración del editor

eslint.config.mjs           # Configuración ESLint (flat config)
.prettierrc                 # Configuración Prettier
.prettierignore             # Archivos ignorados por Prettier
.editorconfig               # Configuración EditorConfig
commitlint.config.mjs       # Reglas de commitlint
```

---

## 5. Criterios de Aceptación

| #   | Criterio                                                  | Verificación                       |
| --- | --------------------------------------------------------- | ---------------------------------- |
| 1   | `npm run lint` ejecuta sin errores                        | Exit code 0                        |
| 2   | `npm run format:check` verifica formato sin errores       | Exit code 0                        |
| 3   | `npm run typecheck` compila sin errores de tipos          | Exit code 0                        |
| 4   | Pre-commit hook ejecuta lint-staged                       | Hacer commit y verificar           |
| 5   | commitlint rechaza mensajes fuera de Conventional Commits | `git commit -m "bad"` falla        |
| 6   | commitlint acepta scopes de NexoERP                       | `feat(invoicing): ...` pasa        |
| 7   | Prettier formatea archivos .ts, .tsx, .json, .md          | `npm run format` modifica archivos |
| 8   | ESLint detecta imports desordenados                       | Mover un import y verificar        |
| 9   | ESLint detecta unused vars                                | Crear variable sin usar            |
| 10  | Changesets inicializado                                   | Directorio `.changeset/` existe    |
| 11  | EditorConfig configurado                                  | `.editorconfig` existe             |
| 12  | VS Code extensions recomendadas definidas                 | `.vscode/extensions.json`          |

---

## 6. Checklist de Verificación

```
□ ESLint configurado con plugins (typescript, jsx-a11y, tailwindcss, import)
□ eslint-config-prettier instalado (evita conflictos con Prettier)
□ Prettier configurado con plugin de Tailwind
□ .prettierignore creado
□ Husky inicializado con hooks
□ pre-commit ejecuta lint-staged
□ lint-staged configurado para .ts, .tsx, .json, .md, .prisma
□ commitlint instalado con config-conventional
□ commit-msg hook ejecuta commitlint
□ Scopes de NexoERP configurados en commitlint (core, auth, contacts, etc.)
□ Changesets inicializado con config.json
□ .editorconfig creado
□ .vscode/extensions.json con recomendaciones
□ .vscode/settings.json con formateo automático
□ npm run lint funciona
□ npm run format:check funciona
□ npm run typecheck funciona
□ Commit con formato correcto pasa
□ Commit con formato incorrecto falla
```

---

## 7. Notas Técnicas

- **ESLint Flat Config:** Next.js 15 soporta el nuevo formato flat config (`eslint.config.mjs`). Usamos `FlatCompat` para compatibilidad con plugins que aún usan el formato legacy.
- **Prettier + Tailwind Plugin:** `prettier-plugin-tailwindcss` reordena automáticamente las clases de Tailwind siguiendo el orden recomendado.
- **consistent-type-imports:** Fuerza `import type { X }` para imports de tipos, mejorando tree-shaking.
- **commitlint scopes:** Están alineados con los módulos del sistema (core, contacts, accounting, invoicing, purchasing, sales, inventory) más scopes transversales (ui, db, infra, api, deps, config).
- **Changesets vs conventional-changelog:** Changesets permite gestión de versiones más granular y es compatible con monorepos. Se usa `changeset version` para bump y `changeset publish` si se necesita publicar.
- **End of line:** Forzamos `lf` (Linux) para consistencia. Si hay developers en Windows, Git se configura con `core.autocrlf = input`.
