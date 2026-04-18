import { z } from 'zod';
import { AccountType, AccountNature } from '@prisma/client';

export const createAccountSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(20),
  name: z.string().min(1, 'El nombre es requerido').max(200),
  accountType: z.nativeEnum(AccountType),
  accountNature: z.nativeEnum(AccountNature),
  parentId: z.string().uuid('ID de cuenta padre inválido').nullable().optional(),
  allowDirectEntry: z.boolean().default(true),
  isActive: z.boolean().default(true),
  showInReports: z.boolean().default(true),
  description: z.string().max(500).nullable().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();
