import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';

/**
 * Lambda PostConfirmation Trigger — Sincronización Cognito → Prisma
 *
 * Ejecutada automáticamente por Cognito después de confirmar el email del usuario.
 * Crea el registro correspondiente en la tabla `users` de PostgreSQL.
 *
 * Custom attributes requeridos en el user (configurados en sign-up):
 * - custom:company_id (UUID) — Tenant ID
 * - custom:role (String) — Role slug (administrador, gerente, contador, vendedor, auditor)
 * - custom:fullname (String) — Nombre completo
 *
 * Flujo:
 * 1. Usuario se registra en Cognito (email + password + custom attributes)
 * 2. Cognito envía código de verificación por email
 * 3. Usuario confirma email
 * 4. **Esta Lambda se ejecuta** y crea registro en users table
 * 5. User queda sincronizado: Cognito ↔️ PostgreSQL
 *
 * Error handling:
 * - Si falla la inserción en Prisma → Lambda retorna error → Cognito marca user como "Force Change Password"
 * - El usuario deberá contactar soporte para resolver el problema
 *
 * @see REQUIREMENTS.md §7.1 RF-CORE-01 "Sincronización Cognito-Prisma"
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
 */

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL, // Via RDS Proxy
});

export const handler: PostConfirmationTriggerHandler = async (event) => {
  console.warn('PostConfirmation trigger invoked', {
    userPoolId: event.userPoolId,
    userName: event.userName,
    triggerSource: event.triggerSource,
  });

  try {
    // Extraer datos del usuario de Cognito
    const { sub, email } = event.request.userAttributes;
    const companyId = event.request.userAttributes['custom:company_id'];
    const role = event.request.userAttributes['custom:role'];
    const fullName = event.request.userAttributes['custom:fullname'];

    // Validar custom attributes obligatorios
    if (!companyId) {
      throw new Error('Missing required custom attribute: custom:company_id');
    }
    if (!role) {
      throw new Error('Missing required custom attribute: custom:role');
    }
    if (!fullName) {
      throw new Error('Missing required custom attribute: custom:fullname');
    }
    if (!email) {
      throw new Error('Missing required attribute: email');
    }

    // Validar role slug (debe ser uno de los 5 roles del sistema)
    const validRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALESPERSON', 'AUDITOR'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    }

    // Validar UUID format de company_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyId)) {
      throw new Error(`Invalid company_id format: ${companyId}. Must be a valid UUID.`);
    }

    console.warn('Creating user in Prisma', {
      sub,
      email,
      companyId,
      role,
      fullName,
    });

    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    // Verificar límite de usuarios (max_users)
    const currentUserCount = await prisma.user.count({
      where: {
        companyId,
        isActive: true,
      },
    });

    if (currentUserCount >= company.maxUsers) {
      throw new Error(`Company ${companyId} has reached max users limit (${company.maxUsers})`);
    }

    // Crear usuario en Prisma
    // DAR-003: User.id = Cognito sub (no auto-generated UUID)
    await prisma.user.create({
      data: {
        id: sub, // DAR-003: User.id es el Cognito sub
        email: email.toLowerCase(), // Normalizar email a lowercase
        fullName,
        cognitoSub: sub,
        companyId,
        role: role as 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'SALESPERSON' | 'AUDITOR',
        isActive: true,
      },
    });

    console.warn('User created successfully in Prisma', { sub, email });

    // Retornar evento sin modificaciones (requerido por Cognito)
    return event;
  } catch (error) {
    console.error('PostConfirmation Lambda failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      event,
    });

    // Re-throw error para que Cognito marque el user como "Force Change Password"
    // El usuario no podrá hacer login hasta que se resuelva el problema
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};
