/** @type {import('@commitlint/types').UserConfig} */
const commitlintConfig = {
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

export default commitlintConfig;
