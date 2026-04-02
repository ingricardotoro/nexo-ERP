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

Write-Host "[1/5] Obteniendo credenciales de Secrets Manager..." -ForegroundColor Yellow
try {
    $appSecretJson = aws secretsmanager get-secret-value --secret-id nexoerp/staging/rds/app --query SecretString --output text
    $adminSecretJson = aws secretsmanager get-secret-value --secret-id nexoerp/staging/rds/master --query SecretString --output text

    $appSecret = $appSecretJson | ConvertFrom-Json
    $adminSecret = $adminSecretJson | ConvertFrom-Json

    Write-Host "  OK: Credenciales obtenidas." -ForegroundColor Green
}
catch {
    Write-Host "  ERROR: No se pudieron obtener los secrets requeridos." -ForegroundColor Red
    Write-Host "  Esperados: nexoerp/staging/rds/app y nexoerp/staging/rds/master" -ForegroundColor Red
    exit 1
}

Write-Host "[2/5] Construyendo connection strings..." -ForegroundColor Yellow

# En staging se usa conexion directa a RDS por costo (sin RDS Proxy por default).
# Fallback: si app secret no trae host/port, usar los del secret admin.
$dbEndpoint = if ($appSecret.host) { $appSecret.host } else { $adminSecret.host }
$rdsEndpoint = $adminSecret.host

$dbPort = if ($appSecret.port) { [int]$appSecret.port } elseif ($adminSecret.port) { [int]$adminSecret.port } else { 5432 }
$rdsPort = if ($adminSecret.port) { [int]$adminSecret.port } else { 5432 }

if (-not $dbEndpoint -or -not $rdsEndpoint) {
    Write-Host "  ERROR: No se encontro host en los secrets de RDS." -ForegroundColor Red
    Write-Host "  Verifica campos host/port en:" -ForegroundColor Red
    Write-Host "    - nexoerp/staging/rds/app" -ForegroundColor Red
    Write-Host "    - nexoerp/staging/rds/master" -ForegroundColor Red
    exit 1
}

$databaseUrl = "postgresql://$($appSecret.username):$($appSecret.password)@${dbEndpoint}:$dbPort/nexoerp?schema=public&sslmode=require&connection_limit=10"
$directUrl = "postgresql://$($adminSecret.username):$($adminSecret.password)@${rdsEndpoint}:$rdsPort/nexoerp?schema=public&sslmode=require"

Write-Host "  OK: Connection strings construidas." -ForegroundColor Green
Write-Host "    DATABASE_URL: postgresql://$($appSecret.username):****@${dbEndpoint}:$dbPort/nexoerp" -ForegroundColor Gray
Write-Host "    DIRECT_URL:   postgresql://$($adminSecret.username):****@${rdsEndpoint}:$rdsPort/nexoerp" -ForegroundColor Gray

if (-not $UserPoolClientId) {
    Write-Host "[3/5] Obteniendo User Pool Client ID..." -ForegroundColor Yellow
    try {
        $UserPoolClientId = aws cognito-idp list-user-pool-clients --user-pool-id us-east-1_adYn3n5fz --max-results 10 --query "UserPoolClients[0].ClientId" --output text
        if (-not $UserPoolClientId -or $UserPoolClientId -eq "None") {
            throw "No se encontro User Pool Client ID"
        }
        Write-Host "  OK: Client ID obtenido: $UserPoolClientId" -ForegroundColor Green
    }
    catch {
        Write-Host "  ERROR: No se pudo obtener User Pool Client ID." -ForegroundColor Red
        Write-Host "  Puedes pasarlo manualmente con -UserPoolClientId ID" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "[3/5] Usando User Pool Client ID proporcionado: $UserPoolClientId" -ForegroundColor Green
}

Write-Host "[4/5] Preparando variables de entorno..." -ForegroundColor Yellow

$envVars = [ordered]@{
    DATABASE_URL                    = $databaseUrl
    DIRECT_URL                      = $directUrl
    NEXT_PUBLIC_AMPLIFY_REGION      = "us-east-1"
    NEXT_PUBLIC_USER_POOL_ID        = "us-east-1_adYn3n5fz"
    NEXT_PUBLIC_USER_POOL_CLIENT_ID = $UserPoolClientId
    NEXT_PUBLIC_S3_BUCKET           = "amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3"
    NODE_ENV                        = "production"
    NEXT_TELEMETRY_DISABLED         = "1"
}

$envVarsJson = $envVars | ConvertTo-Json -Depth 5
$envVarsJson | Out-File -FilePath "amplify-env-vars-staging.json" -Encoding utf8

Write-Host "  OK: Variables preparadas y guardadas en amplify-env-vars-staging.json" -ForegroundColor Green

Write-Host "[5/5] Instrucciones para aplicar en Amplify Console" -ForegroundColor Yellow
Write-Host "  URL: https://console.aws.amazon.com/amplify/home?region=us-east-1#/$AppId" -ForegroundColor Cyan
Write-Host "  Seccion: Environment variables -> Manage variables" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Copia estas variables:" -ForegroundColor White

foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    if ($key -eq "DATABASE_URL" -or $key -eq "DIRECT_URL") {
        Write-Host "  $key (SECRET):" -ForegroundColor White
        Write-Host "    $value" -ForegroundColor DarkGray
    }
    else {
        Write-Host "  $key (PLAINTEXT):" -ForegroundColor White
        Write-Host "    $value" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "OK: Configuracion completada" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Siguientes pasos:" -ForegroundColor Cyan
Write-Host "1. Aplicar variables en Amplify Console" -ForegroundColor White
Write-Host "2. Ejecutar deploy (push a staging o start-job RELEASE)" -ForegroundColor White
Write-Host "3. Revalidar con validate-staging-infra.ps1" -ForegroundColor White
