export type UserRole =
  | 'administrador'
  | 'gerente'
  | 'contador'
  | 'vendedor'
  | 'auditor'
  | 'ADMIN'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'SALESPERSON'
  | 'AUDITOR';

export interface AuthContext {
  userId: string;
  email?: string;
  companyId: string;
  role?: UserRole;
  fullName?: string;
  tokenUse: 'id' | 'access';
  claims: Record<string, unknown>;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status = 401,
    public readonly code = 'UNAUTHORIZED',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
