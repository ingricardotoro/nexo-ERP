'use client';

// src/app/(dashboard)/dashboard/settings/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { Settings, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TenantData {
  id: string;
  legalName: string;
  tradeName: string | null;
  rtn: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  baseCurrency: string;
  maxUsers: number;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [tradeName, setTradeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [department, setDepartment] = useState('');

  const fetchTenant = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/core/tenant', { credentials: 'include' });
      const payload = (await res.json()) as {
        success: boolean;
        data?: { tenant: TenantData };
        error?: string;
      };
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Error al cargar la empresa');
      }
      const t = payload.data.tenant;
      setTenant(t);
      setTradeName(t.tradeName ?? '');
      setEmail(t.email ?? '');
      setPhone(t.phone ?? '');
      setWebsite(t.website ?? '');
      setAddress(t.address ?? '');
      setCity(t.city ?? '');
      setDepartment(t.department ?? '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar la empresa');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTenant();
  }, [fetchTenant]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/core/tenant', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeName: tradeName || undefined,
          email: email || null,
          phone: phone || null,
          website: website || null,
          address: address || null,
          city: city || null,
          department: department || null,
        }),
      });
      const payload = (await res.json()) as {
        success: boolean;
        data?: TenantData;
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? 'Error al guardar');
      toast.success(payload.message ?? 'Empresa actualizada');
      if (payload.data) setTenant(payload.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-muted-foreground text-sm">Datos de la empresa activa</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>

      {/* Datos fiscales (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Identidad Fiscal
          </CardTitle>
          <CardDescription>
            Estos datos son de solo lectura. Para modificarlos contacta al soporte.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Razón Social</Label>
            <p className="mt-1 font-medium">{tenant?.legalName}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">RTN</Label>
            <p className="mt-1 font-mono font-medium tracking-wide">{tenant?.rtn}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Moneda base</Label>
            <div className="mt-1">
              <Badge variant="outline">{tenant?.baseCurrency}</Badge>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Límite de usuarios</Label>
            <p className="mt-1">{tenant?.maxUsers}</p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Datos editables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos Comerciales y de Contacto</CardTitle>
          <CardDescription>
            Información de contacto visible en documentos y reportes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="tradeName">Nombre Comercial</Label>
            <Input
              id="tradeName"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              placeholder="Nombre comercial (si difiere de razón social)"
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="empresa@ejemplo.com"
              maxLength={254}
            />
          </div>

          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+504 2222-3333"
              maxLength={30}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="website">Sitio web</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.empresa.hn"
              maxLength={300}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Colonia, calle, número..."
              maxLength={300}
            />
          </div>

          <div>
            <Label htmlFor="city">Ciudad / Municipio</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Tegucigalpa"
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="department">Departamento</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Francisco Morazán"
              maxLength={100}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
