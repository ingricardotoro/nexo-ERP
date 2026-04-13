'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn, confirmSignIn } from 'aws-amplify/auth';
import type { Route } from 'next';
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME } from '@/constants/app';

// ─── Schemas ────────────────────────────────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const totpSchema = z.object({
  code: z
    .string()
    .length(6, 'El código debe tener 6 dígitos')
    .regex(/^\d+$/, 'Solo se permiten números'),
});

type CredentialsForm = z.infer<typeof credentialsSchema>;
type TotpForm = z.infer<typeof totpSchema>;

// ─── Error messages ──────────────────────────────────────────────────────────

function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Ocurrió un error inesperado. Intenta nuevamente.';

  const name = (error as { name?: string }).name ?? '';

  switch (name) {
    case 'UserNotFoundException':
    case 'NotAuthorizedException':
      return 'Correo o contraseña incorrectos.';
    case 'UserNotConfirmedException':
      return 'Tu cuenta no ha sido verificada. Revisa tu correo electrónico.';
    case 'PasswordResetRequiredException':
      return 'Debes restablecer tu contraseña. Contacta al administrador.';
    case 'TooManyRequestsException':
      return 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.';
    case 'NetworkError':
      return 'Error de red. Verifica tu conexión a internet.';
    case 'CodeMismatchException':
      return 'Código incorrecto. Verifica el código en tu aplicación de autenticación.';
    case 'ExpiredCodeException':
      return 'El código ha expirado. Genera uno nuevo en tu aplicación de autenticación.';
    default:
      return error.message || 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}

// ─── Login page ──────────────────────────────────────────────────────────────

type Step = 'credentials' | 'totp';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('from') ?? '/dashboard';

  const [step, setStep] = useState<Step>('credentials');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // ── Credentials form ────────────────────────────────────────────────────
  const credentialsForm = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  // ── TOTP form ────────────────────────────────────────────────────────────
  const totpForm = useForm<TotpForm>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: '' },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCredentialsSubmit = async (data: CredentialsForm) => {
    setAuthError(null);
    try {
      const result = await signIn({
        username: data.email,
        password: data.password,
      });

      if (result.isSignedIn) {
        router.replace(redirectTo as Route);
        router.refresh();
        return;
      }

      const { signInStep } = result.nextStep;

      if (signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        setStep('totp');
        return;
      }

      // Otros pasos no manejados en UI (ej: NEW_PASSWORD_REQUIRED en primera sesión)
      setAuthError(`Se requiere una acción adicional (${signInStep}). Contacta al administrador.`);
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
    }
  };

  const handleTotpSubmit = async (data: TotpForm) => {
    setAuthError(null);
    try {
      const result = await confirmSignIn({ challengeResponse: data.code });

      if (result.isSignedIn) {
        router.replace(redirectTo as Route);
        router.refresh();
        return;
      }

      setAuthError('No se pudo completar la verificación. Intenta nuevamente.');
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setAuthError(null);
    totpForm.reset();
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Branding */}
      <div className="text-center">
        <h1 className="text-primary-600 text-3xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Sistema ERP para PYMEs hondureñas</p>
      </div>

      {/* Card */}
      <Card className="border shadow-sm">
        {step === 'credentials' ? (
          <>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Iniciar sesión</CardTitle>
              <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={credentialsForm.handleSubmit(handleCredentialsSubmit)}
                className="space-y-4"
                noValidate
              >
                {/* Error general */}
                {authError && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@empresa.com"
                    autoComplete="email"
                    autoFocus
                    {...credentialsForm.register('email')}
                  />
                  {credentialsForm.formState.errors.email && (
                    <p className="text-destructive text-xs">
                      {credentialsForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="pr-10"
                      {...credentialsForm.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {credentialsForm.formState.errors.password && (
                    <p className="text-destructive text-xs">
                      {credentialsForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={credentialsForm.formState.isSubmitting}
                >
                  {credentialsForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Iniciar sesión'
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="pb-4">
              <div className="mb-1 flex items-center gap-2">
                <ShieldCheck className="text-primary-600 h-5 w-5" />
                <CardTitle className="text-xl">Verificación en dos pasos</CardTitle>
              </div>
              <CardDescription>
                Ingresa el código de 6 dígitos de tu aplicación de autenticación (Google
                Authenticator, Authy, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={totpForm.handleSubmit(handleTotpSubmit)}
                className="space-y-4"
                noValidate
              >
                {/* Error general */}
                {authError && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Código TOTP */}
                <div className="space-y-1.5">
                  <Label htmlFor="code">Código de autenticación</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                    className="text-center font-mono text-lg tracking-widest"
                    {...totpForm.register('code')}
                  />
                  {totpForm.formState.errors.code && (
                    <p className="text-destructive text-xs">
                      {totpForm.formState.errors.code.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <Button type="submit" className="w-full" disabled={totpForm.formState.isSubmitting}>
                  {totpForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Verificar código'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleBackToCredentials}
                  disabled={totpForm.formState.isSubmitting}
                >
                  Volver al inicio de sesión
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>

      {/* Footer */}
      <p className="text-muted-foreground text-center text-xs">
        ¿Problemas para acceder? Contacta al administrador del sistema.
      </p>
    </div>
  );
}

// useSearchParams() requiere Suspense boundary en Next.js App Router
export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
