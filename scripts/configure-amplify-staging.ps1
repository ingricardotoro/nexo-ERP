# =========================================================
# Script: Configure Amplify Staging Environment Variables
# Propósito: Automatizar configuración de variables de entorno
#            en AWS Amplify para el branch staging
# =========================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$AppId,
    
    [Parameter(Mandatory=$false)]
    [string]$UserPoolClientId
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NexoERP - Configure Amplify Staging" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# === PASO 1: Obtener credenciales de Secrets Manager ===
Write-Host "[1/5] Obteniendo credenciales de Secrets Manager..." -ForegroundColor Yellow

try {
    $appSecretJson = aws secretsmanager get-secret-value `
        --secret-id nexoerp/staging/rds/app `
        --query SecretString `
        --output text

    $adminSecretJson = aws secretsmanager get-secret-value `
        --secret-id nexoerp/staging/rds/master `
        --query SecretString `
        --output text

    $appSecret = $appSecretJson | ConvertFrom-Json
    $adminSecret = $adminSecretJson | ConvertFrom-Json

    Write-Host "  ✓ Credenciales obtenidas exitosamente" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Error al obtener credenciales de Secrets Manager" -ForegroundColor Red
    Write-Host "    Verifica que los secrets existan: nexoerp/staging/rds/app y nexoerp/staging/rds/master" -ForegroundColor Red
    exit 1
}

# === PASO 2: Construir connection strings ===
Write-Host "[2/5] Construyendo connection strings..." -ForegroundColor Yellow

$proxyEndpoint = $appSecret.host
$rdsEndpoint = $adminSecret.host

$databaseUrl = "postgresql://$($appSecret.username):$($appSecret.password)@$proxyEndpoint:5432/nexoerp?schema=public&sslmode=require&connection_limit=10"
$directUrl = "postgresql://$($adminSecret.username):$($adminSecret.password)@$rdsEndpoint:5432/nexoerp?schema=public&sslmode=require"

Write-Host "  ✓ Connection strings construidas" -ForegroundColor Green
Write-Host "    DATABASE_URL: postgresql://$($appSecret.username):****@$proxyEndpoint:5432/nexoerp" -ForegroundColor Gray
Write-Host "    DIRECT_URL:   postgresql://$($adminSecret.username):****@$rdsEndpoint:5432/nexoerp" -ForegroundColor Gray

# === PASO 3: Obtener User Pool Client ID si no se proporcionó ===
if (-not $UserPoolClientId) {
    Write-Host "[3/5] Obteniendo User Pool Client ID..." -ForegroundColor Yellow
    
    try {
        $UserPoolClientId = aws cognito-idp list-user-pool-clients `
            --user-pool-id us-east-1_adYn3n5fz `
            --max-results 10 `
            --query "UserPoolClients[0].ClientId" `
            --output text

        Write-Host "  ✓ Client ID obtenido: $UserPoolClientId" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Error al obtener User Pool Client ID" -ForegroundColor Red
        Write-Host "    Proporciona manualmente con -UserPoolClientId <ID>" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[3/5] Usando User Pool Client ID proporcionado: $UserPoolClientId" -ForegroundColor Green
}

# === PASO 4: Preparar JSON de variables de entorno ===
Write-Host "[4/5] Preparando configuración de variables de entorno..." -ForegroundColor Yellow

$envVars = @{
    DATABASE_URL = $databaseUrl
    DIRECT_URL = $directUrl
    NEXT_PUBLIC_AMPLIFY_REGION = "us-east-1"
    NEXT_PUBLIC_USER_POOL_ID = "us-east-1_adYn3n5fz"
    NEXT_PUBLIC_USER_POOL_CLIENT_ID = $UserPoolClientId
    NEXT_PUBLIC_S3_BUCKET = "amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3"
    NODE_ENV = "production"
    NEXT_TELEMETRY_DISABLED = "1"
}

$envVarsJson = $envVars | ConvertTo-Json -Compress

Write-Host "  ✓ Configuración preparada (8 variables)" -ForegroundColor Green

# === PASO 5: Aplicar configuración a Amplify ===
Write-Host "[5/5] Aplicando configuración al branch staging en Amplify..." -ForegroundColor Yellow

try {
    # Nota: aws amplify update-branch no soporta JSON directo en --environment-variables
    # Necesitamos hacer múltiples llamadas o usar AWS SDK
    
    # Alternativa: Usar AWS Console o script Python con boto3
    Write-Host "  ℹ Configuración manual requerida via AWS Console" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Ir a: https://console.aws.amazon.com/amplify/home?region=us-east-1#/$AppId" -ForegroundColor Cyan
    Write-Host "  → Environment variables → Manage variables" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Copiar las siguientes variables:" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    foreach ($key in $envVars.Keys) {
        $value = $envVars[$key]
        if ($key -eq "DATABASE_URL" -or $key -eq "DIRECT_URL") {
            Write-Host "  $key (SECRET):" -ForegroundColor White
            Write-Host "    $value" -ForegroundColor DarkGray
        } else {
            Write-Host "  $key (PLAINTEXT):" -ForegroundColor White
            Write-Host "    $value" -ForegroundColor Gray
        }
    }
    Write-Host "  ─────────────────────────────────────────────────────────" -ForegroundColor Gray
    Write-Host ""
    
    # Guardar en archivo temporal para referencia
    $envVarsJson | Out-File -FilePath "amplify-env-vars-staging.json" -Encoding UTF8
    Write-Host "  ✓ Variables guardadas en: amplify-env-vars-staging.json" -ForegroundColor Green
    Write-Host "    (NO commitear este archivo — ya está en .gitignore)" -ForegroundColor Red
    
} catch {
    Write-Host "  ✗ Error al aplicar configuración" -ForegroundColor Red
    Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ Configuración completada" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Configurar variables en Amplify Console (ver arriba)" -ForegroundColor White
Write-Host "2. Trigger deploy: git push origin staging" -ForegroundColor White
Write-Host "3. Verificar build: aws amplify list-jobs --app-id $AppId --branch-name staging" -ForegroundColor White
Write-Host ""
