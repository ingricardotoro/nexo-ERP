import { defineAuth } from '@aws-amplify/backend';

/**
 * NexoERP — Configuración de Autenticación (Cognito)
 *
 * Configuración del User Pool con:
 * - Login por email
 * - Verificación de email obligatoria
 * - Política de contraseñas robusta
 * - Grupos para RBAC (se crean en Fase 1)
 * - Atributos custom para multi-tenancy
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
  // Email es obligatorio por loginWith.email
  // Los atributos custom son para multi-tenancy y RBAC
  userAttributes: {
    // Company ID para aislamiento multi-tenant (UUID)
    'custom:company_id': {
      dataType: 'String',
      mutable: true,
    },
    // Role slug para RBAC (administrador, gerente, contador, vendedor, auditor)
    'custom:role': {
      dataType: 'String',
      mutable: true,
    },
    // Nombre completo del usuario
    'custom:fullname': {
      dataType: 'String',
      mutable: true,
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
