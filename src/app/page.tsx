import { APP_NAME, APP_VERSION } from '@/constants/app';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary-600">{APP_NAME}</h1>
        <p className="mt-2 text-muted-foreground">
          Sistema ERP modular para PYMEs hondureñas
        </p>
        <p className="mt-4 font-mono text-sm text-muted-foreground">
          v{APP_VERSION} — Fase 0: Fundación
        </p>
      </div>
    </main>
  );
}
