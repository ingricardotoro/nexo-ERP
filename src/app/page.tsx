import { APP_NAME, APP_VERSION } from '@/constants/app';

export default function HomePage() {
  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-primary-600 text-4xl font-bold">{APP_NAME}</h1>
        <p className="text-muted-foreground mt-2">Sistema ERP modular para PYMEs hondureñas</p>
        <p className="text-muted-foreground mt-4 font-mono text-sm">
          v{APP_VERSION} — Fase 0: Fundación
        </p>
      </div>
    </main>
  );
}
