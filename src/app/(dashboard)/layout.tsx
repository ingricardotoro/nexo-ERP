// src/app/(dashboard)/layout.tsx
import { headers } from 'next/headers';
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { TenantProvider } from '@/lib/context/tenant-context';
import prisma from '@/lib/db/prisma';

/**
 * Obtiene los datos del tenant desde la BD usando los headers de auth inyectados
 * por el middleware. Al ejecutarse en el servidor, los datos llegan al cliente
 * sin flash de "Cargando empresa..." (sin fetch client-side en el initial render).
 */
async function getInitialTenantData() {
  try {
    const headersList = await headers();
    const companyId = headersList.get('x-company-id');
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role');
    const email = headersList.get('x-user-email');
    const fullName = headersList.get('x-user-fullname');

    if (!companyId || !userId) return null;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        rtn: true,
        maxUsers: true,
        isActive: true,
      },
    });

    if (!company?.isActive) return null;

    return {
      tenant: company,
      session: {
        userId,
        email: email ?? null,
        fullName: fullName ?? null,
        role: role ?? null,
      },
    };
  } catch {
    return null;
  }
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialData = await getInitialTenantData();

  return (
    <TenantProvider initialData={initialData}>
      <div className="bg-background min-h-screen">
        <DashboardSidebar />
        <div className="pl-64">
          <DashboardHeader />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </TenantProvider>
  );
}
