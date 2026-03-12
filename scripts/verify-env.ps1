<#
.SYNOPSIS
    Script de verificación de ambiente de desarrollo local para NexoERP.

.DESCRIPTION
    Verifica que todos los servicios, archivos y configuraciones estén correctas
    para trabajar en el entorno de desarrollo local.

.EXAMPLE
    powershell scripts/verify-env.ps1
#>

Write-Host "`nNexoERP - Verificacion de Ambiente Local`n" -ForegroundColor Cyan

$allGood = $true

# 1. Docker
Write-Host "1. Docker..." -NoNewline
try {
    $null = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        Write-Host " [ERROR] Docker no esta corriendo" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host " [ERROR] Docker no esta corriendo" -ForegroundColor Red
    $allGood = $false
}

# 2. Contenedor PostgreSQL
Write-Host "2. PostgreSQL (contenedor nexoerp-postgres)..." -NoNewline
try {
    $container = docker ps --filter "name=nexoerp-postgres" --format "{{.Names}}" 2>$null
    if ($container -eq "nexoerp-postgres") {
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        Write-Host " [ERROR] Contenedor no esta corriendo (ejecuta: docker compose up -d)" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host " [ERROR] No disponible" -ForegroundColor Red
    $allGood = $false
}

# 3. Conexión PostgreSQL
Write-Host "3. Conexion PostgreSQL..." -NoNewline
try {
    $pgReady = docker exec nexoerp-postgres pg_isready -U nexoerp 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        Write-Host " [ERROR] PostgreSQL no responde" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host " [ERROR] No disponible" -ForegroundColor Red
    $allGood = $false
}

# 4. .env.local
Write-Host "4. .env.local..." -NoNewline
if (Test-Path ".env.local") {
    Write-Host " [OK]" -ForegroundColor Green
} else {
    Write-Host " [ERROR] No existe (copiar de .env.example)" -ForegroundColor Red
    $allGood = $false
}

# 5. node_modules
Write-Host "5. node_modules..." -NoNewline
if (Test-Path "node_modules") {
    Write-Host " [OK]" -ForegroundColor Green
} else {
    Write-Host " [ERROR] Ejecutar 'npm install'" -ForegroundColor Red
    $allGood = $false
}

# 6. Prisma Client
Write-Host "6. Prisma Client..." -NoNewline
if (Test-Path "node_modules/.prisma/client") {
    Write-Host " [OK]" -ForegroundColor Green
} else {
    Write-Host " [ERROR] Ejecutar 'npx prisma generate'" -ForegroundColor Red
    $allGood = $false
}

# 7. Migraciones aplicadas
Write-Host "7. Migraciones Prisma..." -NoNewline
try {
    $status = npx prisma migrate status --schema prisma/schema/base.prisma 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        Write-Host " [WARN] Ejecutar 'npx prisma migrate deploy'" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host " [WARN] No se pudo verificar (ejecutar 'npx prisma migrate deploy')" -ForegroundColor Yellow
    $allGood = $false
}

# 8. Contenedor pgAdmin (opcional)
Write-Host "8. pgAdmin (opcional)..." -NoNewline
try {
    $pgadminContainer = docker ps --filter "name=nexoerp-pgadmin" --format "{{.Names}}" 2>$null
    if ($pgadminContainer -eq "nexoerp-pgadmin") {
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        Write-Host " [WARN] No esta corriendo (opcional)" -ForegroundColor Yellow
    }
} catch {
    Write-Host " [WARN] No disponible (opcional)" -ForegroundColor Yellow
}

# 9. Contenedor MailHog (opcional)
Write-Host "9. MailHog (opcional)..." -NoNewline
try {
    $mailhogContainer = docker ps --filter "name=nexoerp-mailhog" --format "{{.Names}}" 2>$null
    if ($mailhogContainer -eq "nexoerp-mailhog") {
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        Write-Host " [WARN] No esta corriendo (opcional)" -ForegroundColor Yellow
    }
} catch {
    Write-Host " [WARN] No disponible (opcional)" -ForegroundColor Yellow
}

# Resumen final
Write-Host ""
if ($allGood) {
    Write-Host "Ambiente de desarrollo LISTO" -ForegroundColor Green
} else {
    Write-Host "Hay problemas en tu ambiente de desarrollo" -ForegroundColor Red
    Write-Host "   Ejecuta: npm run dev:setup para configurar automaticamente" -ForegroundColor Yellow
}

Write-Host "`nServicios:" -ForegroundColor Cyan
Write-Host '   App:     http://localhost:3000'
Write-Host '   pgAdmin: http://localhost:5050 (admin@nexoerp.com / admin123)'
Write-Host '   MailHog: http://localhost:8025'
Write-Host ""

if (-not $allGood) {
    exit 1
}
