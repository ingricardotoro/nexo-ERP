---
name: project_infra_state
description: Estado confirmado de recursos AWS en staging NexoERP (IDs, checks, hallazgos)
type: project
---

Amplify App ID: d2f5m16ikivgje (rama staging, ultimo job SUCCEED, Job ID 4)
Cognito User Pool: us-east-1_adYn3n5fz — MFA=OPTIONAL, custom attrs company_id/role/fullname presentes
S3 Bucket docs: amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3 — Block Public Access OK, SSE=AES256
RDS: nexoerp-staging — PostgreSQL 16.4, db.t3.micro, 20GB gp3 3000 IOPS, backup 7d, encrypted, logs postgresql+upgrade
RDS SG: nexoerp-staging-rds-sg — inbound 5432 confirmado
IAM user CLI: nexoerp-developer (cuenta 155326049791)

PROBLEMA ABIERTO (2026-03-22):
DATABASE_URL y DIRECT_URL en Amplify NO incluyen host:puerto.
Formato actual: postgresql://user:pass@/dbname?...  (RDS Proxy omitido entre @ y /)
Formato requerido por el script y por Prisma: postgresql://user:pass@host:5432/dbname?...
Las URLs deben actualizarse en Amplify Console > Environment variables con el endpoint real del RDS Proxy (o RDS directo para DIRECT_URL).

**Why:** RDS Proxy no esta configurado en staging aun. Las URLs actuales son placeholders que no funcionan para conexion real de Prisma.
**How to apply:** Antes de cualquier migracion o deploy que requiera BD en staging, verificar que DATABASE_URL y DIRECT_URL tengan host real.
