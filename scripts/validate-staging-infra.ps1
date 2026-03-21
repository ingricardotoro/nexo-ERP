param(
  [string]$AwsRegion = "us-east-1",
  [string]$RdsInstanceId = "nexoerp-staging",
  [string]$RdsSecurityGroupName = "nexoerp-staging-rds-sg",
  [string]$RdsProxyName = "nexoerp-staging-proxy",
  [string]$RdsProxyRoleName = "NexoERPStagingRDSProxyRole",
  [string]$CognitoUserPoolId = "us-east-1_adYn3n5fz",
  [string]$S3BucketName = "amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3",
  [string]$AmplifyAppId = "",
  [string]$AmplifyBranchName = "staging",
  [switch]$StrictS3PathPolicy,
  [switch]$EnableRdsProxyChecks
)

$ErrorActionPreference = "Stop"
$env:AWS_DEFAULT_REGION = $AwsRegion

$script:Passed = 0
$script:Failed = 0
$script:Skipped = 0

function Invoke-AwsJson {
  param(
    [Parameter(Mandatory = $true)][string]$CliArgs
  )

  $output = Invoke-Expression "aws $CliArgs" 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "aws $CliArgs"
  }

  if ([string]::IsNullOrWhiteSpace($output)) {
    return $null
  }

  return $output | ConvertFrom-Json
}

function Report-Result {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][bool]$Ok,
    [string]$Detail = ""
  )

  if ($Ok) {
    $script:Passed++
    Write-Host "[PASS] $Name" -ForegroundColor Green
  }
  else {
    $script:Failed++
    Write-Host "[FAIL] $Name" -ForegroundColor Red
  }

  if ($Detail) {
    Write-Host "       $Detail" -ForegroundColor DarkGray
  }
}

function Report-Skip {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$Detail = ""
  )

  $script:Skipped++
  Write-Host "[SKIP] $Name" -ForegroundColor Yellow
  if ($Detail) {
    Write-Host "       $Detail" -ForegroundColor DarkGray
  }
}

function Check {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Test,
    [string]$SuccessDetail = "",
    [string]$FailureDetail = ""
  )

  try {
    $ok = & $Test
    if ($ok) {
      Report-Result -Name $Name -Ok $true -Detail $SuccessDetail
    }
    else {
      Report-Result -Name $Name -Ok $false -Detail $FailureDetail
    }
  }
  catch {
    Report-Result -Name $Name -Ok $false -Detail $_.Exception.Message
  }
}

function Convert-EnvObjectToHashtable {
  param(
    $InputObject
  )

  $result = @{}
  if ($null -eq $InputObject) {
    return $result
  }

  if ($InputObject -is [hashtable]) {
    foreach ($key in $InputObject.Keys) {
      $result[$key] = [string]$InputObject[$key]
    }
    return $result
  }

  if ($InputObject.PSObject -and $InputObject.PSObject.Properties) {
    foreach ($prop in $InputObject.PSObject.Properties) {
      $result[$prop.Name] = [string]$prop.Value
    }
  }

  return $result
}

Write-Host "=== NexoERP Staging Infra Validation ===" -ForegroundColor Cyan
Write-Host "Region: $AwsRegion" -ForegroundColor DarkCyan
Write-Host ""

# Prerrequisito: sesión AWS
Check -Name "AWS session activa" -Test {
  $id = Invoke-AwsJson "sts get-caller-identity --output json"
  return $null -ne $id.Account
} -SuccessDetail "Credenciales AWS detectadas." -FailureDetail "No hay sesión AWS válida."

Write-Host "`n--- Fase 1: RDS PostgreSQL ---" -ForegroundColor Cyan

$rds = $null
try {
  $rds = Invoke-AwsJson "rds describe-db-instances --db-instance-identifier $RdsInstanceId --output json"
  $db = $rds.DBInstances[0]

  Check -Name "RDS disponible" -Test { $db.DBInstanceStatus -eq "available" } -SuccessDetail "Status=$($db.DBInstanceStatus)" -FailureDetail "Status=$($db.DBInstanceStatus)"
  Check -Name "RDS PostgreSQL 16.x" -Test { $db.Engine -eq "postgres" -and $db.EngineVersion -like "16*" } -SuccessDetail "EngineVersion=$($db.EngineVersion)" -FailureDetail "EngineVersion=$($db.EngineVersion)"
  Check -Name "RDS class db.t3.micro" -Test { $db.DBInstanceClass -eq "db.t3.micro" } -SuccessDetail "Class=$($db.DBInstanceClass)" -FailureDetail "Class=$($db.DBInstanceClass)"
  Check -Name "RDS storage 20GB gp3 3000 IOPS" -Test { $db.AllocatedStorage -eq 20 -and $db.StorageType -eq "gp3" -and $db.Iops -eq 3000 } -SuccessDetail "Storage=$($db.AllocatedStorage)GB $($db.StorageType) IOPS=$($db.Iops)" -FailureDetail "Storage=$($db.AllocatedStorage)GB $($db.StorageType) IOPS=$($db.Iops)"
  Check -Name "RDS backup retention 7 dias" -Test { $db.BackupRetentionPeriod -eq 7 } -SuccessDetail "BackupRetentionPeriod=$($db.BackupRetentionPeriod)" -FailureDetail "BackupRetentionPeriod=$($db.BackupRetentionPeriod)"
  Check -Name "RDS encryption habilitada" -Test { $db.StorageEncrypted -eq $true } -SuccessDetail "StorageEncrypted=true" -FailureDetail "StorageEncrypted=false"

  $logs = @($db.EnabledCloudwatchLogsExports)
  Check -Name "RDS logs postgresql y upgrade" -Test { $logs -contains "postgresql" -and $logs -contains "upgrade" } -SuccessDetail ("Logs=" + ($logs -join ",")) -FailureDetail ("Logs=" + ($logs -join ","))
}
catch {
  Report-Result -Name "RDS instance existe" -Ok $false -Detail "No se pudo consultar $RdsInstanceId"
}

try {
  $sg = Invoke-AwsJson "ec2 describe-security-groups --group-names $RdsSecurityGroupName --output json"
  $group = $sg.SecurityGroups[0]
  Check -Name "RDS Security Group existe" -Test { $group.GroupName -eq $RdsSecurityGroupName } -SuccessDetail "GroupName=$($group.GroupName)" -FailureDetail "No coincide GroupName"

  $has5432 = $false
  foreach ($rule in $group.IpPermissions) {
    if ($rule.FromPort -eq 5432 -and $rule.ToPort -eq 5432) {
      $has5432 = $true
      break
    }
  }

  Check -Name "RDS SG tiene inbound 5432" -Test { $has5432 } -SuccessDetail "Inbound 5432 detectado." -FailureDetail "No se encontro inbound 5432."
}
catch {
  Report-Result -Name "RDS Security Group existe" -Ok $false -Detail "No se pudo consultar $RdsSecurityGroupName"
}

Write-Host "`n--- Fase 2: RDS Proxy ---" -ForegroundColor Cyan

if (-not $EnableRdsProxyChecks) {
  Report-Skip -Name "RDS Proxy checks" -Detail "Omitido por default en staging para reducir costos. Usa -EnableRdsProxyChecks para validar proxy."
}
else {
  try {
    $proxy = Invoke-AwsJson "rds describe-db-proxies --db-proxy-name $RdsProxyName --output json"
    $p = $proxy.DBProxies[0]

    Check -Name "RDS Proxy disponible" -Test { $p.Status -eq "available" } -SuccessDetail "Status=$($p.Status)" -FailureDetail "Status=$($p.Status)"
    Check -Name "RDS Proxy TLS requerido" -Test { $p.RequireTLS -eq $true } -SuccessDetail "RequireTLS=true" -FailureDetail "RequireTLS=false"

    try {
      $targets = Invoke-AwsJson "rds describe-db-proxy-targets --db-proxy-name $RdsProxyName --output json"
      $hasTarget = $false
      foreach ($t in $targets.Targets) {
        if ($t.RdsResourceId) {
          $hasTarget = $true
          break
        }
      }
      Check -Name "RDS Proxy target registrado" -Test { $hasTarget } -SuccessDetail "Target detectado." -FailureDetail "No se detectaron targets."
    }
    catch {
      Report-Result -Name "RDS Proxy target registrado" -Ok $false -Detail "No se pudo consultar targets."
    }

    try {
      $tg = Invoke-AwsJson "rds describe-db-proxy-target-groups --db-proxy-name $RdsProxyName --output json"
      $cfg = $tg.TargetGroups[0].ConnectionPoolConfig
      Check -Name "Pool config 75/50" -Test { $cfg.MaxConnectionsPercent -eq 75 -and $cfg.MaxIdleConnectionsPercent -eq 50 } -SuccessDetail "MaxConn=$($cfg.MaxConnectionsPercent) MaxIdle=$($cfg.MaxIdleConnectionsPercent)" -FailureDetail "MaxConn=$($cfg.MaxConnectionsPercent) MaxIdle=$($cfg.MaxIdleConnectionsPercent)"
    }
    catch {
      Report-Result -Name "Pool config 75/50" -Ok $false -Detail "No se pudo consultar target groups."
    }
  }
  catch {
    Report-Result -Name "RDS Proxy existe" -Ok $false -Detail "No se pudo consultar $RdsProxyName"
  }

  try {
    $role = Invoke-AwsJson "iam get-role --role-name $RdsProxyRoleName --output json"
    Check -Name "IAM role RDS Proxy existe" -Test { $role.Role.RoleName -eq $RdsProxyRoleName } -SuccessDetail "Role=$RdsProxyRoleName" -FailureDetail "Role no encontrado"

    $pol = Invoke-AwsJson "iam list-attached-role-policies --role-name $RdsProxyRoleName --output json"
    $hasSm = $false
    foreach ($ap in $pol.AttachedPolicies) {
      if ($ap.PolicyName -eq "SecretsManagerReadWrite") {
        $hasSm = $true
        break
      }
    }
    Check -Name "Role tiene SecretsManagerReadWrite" -Test { $hasSm } -SuccessDetail "Policy adjunta." -FailureDetail "Policy no encontrada."
  }
  catch {
    Report-Result -Name "IAM role RDS Proxy existe" -Ok $false -Detail "No se pudo consultar $RdsProxyRoleName"
  }
}

Write-Host "`n--- Fase 4: Cognito ---" -ForegroundColor Cyan

try {
  $up = Invoke-AwsJson "cognito-idp describe-user-pool --user-pool-id $CognitoUserPoolId --output json"
  $pool = $up.UserPool

  Check -Name "User Pool accesible" -Test { $null -ne $pool.Id } -SuccessDetail "Pool=$($pool.Name)" -FailureDetail "No se pudo leer User Pool"
  Check -Name "MFA OPTIONAL" -Test { $pool.MfaConfiguration -eq "OPTIONAL" } -SuccessDetail "MFA=$($pool.MfaConfiguration)" -FailureDetail "MFA=$($pool.MfaConfiguration)"

  $auto = @($pool.AutoVerifiedAttributes)
  Check -Name "Email auto-verified" -Test { $auto -contains "email" } -SuccessDetail ("AutoVerified=" + ($auto -join ",")) -FailureDetail ("AutoVerified=" + ($auto -join ","))

  $attrs = @($pool.SchemaAttributes)
  $hasCompany = $false
  $hasRole = $false
  $hasFullname = $false

  foreach ($a in $attrs) {
    if ($a.Name -eq "custom:company_id") { $hasCompany = $true }
    if ($a.Name -eq "custom:role") { $hasRole = $true }
    if ($a.Name -eq "custom:fullname") { $hasFullname = $true }
  }

  Check -Name "Custom attr company_id" -Test { $hasCompany }
  Check -Name "Custom attr role" -Test { $hasRole }
  Check -Name "Custom attr fullname" -Test { $hasFullname }

  $clients = Invoke-AwsJson "cognito-idp list-user-pool-clients --user-pool-id $CognitoUserPoolId --output json"
  $count = @($clients.UserPoolClients).Count
  Check -Name "Existe al menos 1 app client" -Test { $count -ge 1 } -SuccessDetail "Clients=$count" -FailureDetail "Clients=0"
}
catch {
  Report-Result -Name "Cognito checks" -Ok $false -Detail "No se pudo consultar User Pool $CognitoUserPoolId"
}

Write-Host "`n--- Fase 6: S3 ---" -ForegroundColor Cyan

try {
  $block = Invoke-AwsJson "s3api get-public-access-block --bucket $S3BucketName --output json"
  $pb = $block.PublicAccessBlockConfiguration
  $allTrue = $pb.BlockPublicAcls -and $pb.IgnorePublicAcls -and $pb.BlockPublicPolicy -and $pb.RestrictPublicBuckets
  Check -Name "S3 Block Public Access completo" -Test { $allTrue } -SuccessDetail "Todos los flags en true." -FailureDetail "Hay flags en false."

  $enc = Invoke-AwsJson "s3api get-bucket-encryption --bucket $S3BucketName --output json"
  $algo = $enc.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm
  Check -Name "S3 encryption habilitado" -Test { $algo -eq "AES256" -or $algo -eq "aws:kms" } -SuccessDetail "SSE=$algo" -FailureDetail "SSE no configurado"

  try {
    $policyText = aws s3api get-bucket-policy --bucket $S3BucketName --query Policy --output text 2>$null
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo leer policy"
    }

    $hasLogos = $policyText -match "logos/.+\*"
    $hasDocs = $policyText -match "documents/.+\*"
    $hasTemp = $policyText -match "temp/.+\*"
    if ($hasLogos -and $hasDocs -and $hasTemp) {
      Report-Result -Name "S3 path policies logos/documents/temp" -Ok $true -Detail "Policies path-based detectadas."
    }
    elseif ($StrictS3PathPolicy) {
      Report-Result -Name "S3 path policies logos/documents/temp" -Ok $false -Detail "No se detectaron todos los paths esperados."
    }
    else {
      Report-Skip -Name "S3 path policies logos/documents/temp" -Detail "No detectadas en bucket policy. En Amplify Gen 2 esto puede gestionarse via IAM/path rules. Usa -StrictS3PathPolicy para forzar FAIL."
    }
  }
  catch {
    if ($StrictS3PathPolicy) {
      Report-Result -Name "S3 path policies logos/documents/temp" -Ok $false -Detail "No se pudo validar bucket policy."
    }
    else {
      Report-Skip -Name "S3 path policies logos/documents/temp" -Detail "No se pudo validar bucket policy."
    }
  }
}
catch {
  Report-Result -Name "S3 checks" -Ok $false -Detail "No se pudo consultar bucket $S3BucketName"
}

Write-Host "`n--- Fase 7: Amplify (si hay APP_ID) ---" -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($AmplifyAppId)) {
  Report-Skip -Name "Amplify branch/env vars/deploy" -Detail "Pasa -AmplifyAppId para validar Fase 7 automaticamente."
}
else {
  try {
    $branch = Invoke-AwsJson "amplify get-branch --app-id $AmplifyAppId --branch-name $AmplifyBranchName --output json"
    $b = $branch.branch

    Check -Name "Amplify branch staging existe" -Test { $b.branchName -eq $AmplifyBranchName } -SuccessDetail "Branch=$($b.branchName)" -FailureDetail "Branch no encontrada"
    Check -Name "Amplify auto-build habilitado" -Test { $b.enableAutoBuild -eq $true } -SuccessDetail "AutoBuild=true" -FailureDetail "AutoBuild=false"

    $appEnvVars = @{}
    try {
      $appInfo = Invoke-AwsJson "amplify get-app --app-id $AmplifyAppId --output json"
      $appEnvVars = Convert-EnvObjectToHashtable -InputObject $appInfo.app.environmentVariables
    }
    catch {
      Report-Skip -Name "Amplify app env vars (nivel app)" -Detail "No se pudieron leer (permiso o API). Se valida solo con branch env vars."
    }
    $branchEnvVars = Convert-EnvObjectToHashtable -InputObject $b.environmentVariables
    $envVars = @{}
    foreach ($key in $appEnvVars.Keys) { $envVars[$key] = $appEnvVars[$key] }
    foreach ($key in $branchEnvVars.Keys) { $envVars[$key] = $branchEnvVars[$key] }
    $required = @(
      "DATABASE_URL",
      "DIRECT_URL",
      "NEXT_PUBLIC_AMPLIFY_REGION",
      "NEXT_PUBLIC_USER_POOL_ID",
      "NEXT_PUBLIC_USER_POOL_CLIENT_ID",
      "NEXT_PUBLIC_S3_BUCKET",
      "NODE_ENV",
      "NEXT_TELEMETRY_DISABLED"
    )

    $missing = @()
    foreach ($k in $required) {
      if (-not $envVars.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($envVars[$k])) {
        $missing += $k
      }
    }

    Check -Name "Amplify env vars requeridas" -Test { $missing.Count -eq 0 } -SuccessDetail "8 variables detectadas." -FailureDetail ("Faltan: " + ($missing -join ", "))

    $dbUrl = [string]$envVars["DATABASE_URL"]
    $directUrl = [string]$envVars["DIRECT_URL"]
    $dbUrlPattern = '^postgresql:\/\/[^:\/\?]+:[^@]+@[^:\/\?]+:\d+\/.+'
    Check -Name "Amplify DATABASE_URL formato valido" -Test { $dbUrl -match $dbUrlPattern } -SuccessDetail "DATABASE_URL incluye host/puerto." -FailureDetail "DATABASE_URL invalida o sin host."
    Check -Name "Amplify DIRECT_URL formato valido" -Test { $directUrl -match $dbUrlPattern } -SuccessDetail "DIRECT_URL incluye host/puerto." -FailureDetail "DIRECT_URL invalida o sin host."

    $jobs = Invoke-AwsJson "amplify list-jobs --app-id $AmplifyAppId --branch-name $AmplifyBranchName --max-results 1 --output json"
    $latest = $jobs.jobSummaries | Select-Object -First 1

    if ($null -eq $latest) {
      Report-Skip -Name "Ultimo deploy Amplify exitoso" -Detail "No hay jobs en el branch para validar estado."
    }
    else {
      Check -Name "Ultimo deploy Amplify exitoso" -Test { $latest.status -eq "SUCCEED" } -SuccessDetail "Status=$($latest.status) Job=$($latest.jobId)" -FailureDetail "Status=$($latest.status) Job=$($latest.jobId)"
    }

    if ($b.defaultDomain) {
      Write-Host "[INFO] Dominio base: $($b.defaultDomain)" -ForegroundColor Cyan
      Write-Host "[INFO] URL staging: https://$AmplifyBranchName.$($b.defaultDomain)" -ForegroundColor Cyan
    }
  }
  catch {
    Report-Result -Name "Amplify checks" -Ok $false -Detail "No se pudo validar app ${AmplifyAppId}: $($_.Exception.Message)"
  }
}

Write-Host "`n=== Resumen ===" -ForegroundColor Cyan
Write-Host "PASS:   $script:Passed" -ForegroundColor Green
Write-Host "FAIL:   $script:Failed" -ForegroundColor Red
Write-Host "SKIP:   $script:Skipped" -ForegroundColor Yellow

if ($script:Failed -gt 0) {
  Write-Host "`nResultado: HAY ITEMS PENDIENTES/BLOQUEADOS" -ForegroundColor Red
  exit 1
}

Write-Host "`nResultado: VALIDACION BASE OK" -ForegroundColor Green
exit 0
