'use client';

// src/app/(dashboard)/dashboard/sales/opportunities/page.tsx
import { TrendingUp, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function OpportunitiesPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30">
        <TrendingUp className="h-8 w-8 text-blue-500" />
      </div>

      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Pipeline de Ventas</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          El módulo de oportunidades y CRM está en desarrollo. Podrás gestionar prospectos, etapas
          del pipeline y probabilidades de cierre.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Funcionalidades planificadas</CardTitle>
          <CardDescription>Próximas versiones del módulo de ventas</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground space-y-2 text-sm">
            {[
              'Pipeline Kanban por etapas de venta',
              'Probabilidad de cierre por oportunidad',
              'Vinculación de contactos y empresas',
              'Conversión directa a Pedido de Venta',
              'Reportes de embudo de ventas',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="bg-muted h-1.5 w-1.5 shrink-0 rounded-full" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        onClick={() => router.push('/dashboard/sales/orders' as never)}
        className="gap-2"
      >
        <ClipboardList className="h-4 w-4" />
        Ver Pedidos de Venta
      </Button>
    </div>
  );
}
