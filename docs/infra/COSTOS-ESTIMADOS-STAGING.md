# NexoERP Staging — Estimación de Costos AWS

## Objetivo

Proyectar costos mensuales de infraestructura AWS para el ambiente de **staging**, asegurando que se mantenga dentro del presupuesto de ~$50/mes.

---

## Asunciones de Uso (Staging)

- Tráfico: **Bajo a moderado** (QA interna, demos a clientes, development testing)
- Requests/mes: ~100,000 (equivalente a ~3,300 requests/día)
- Data transfer: ~10 GB/mes
- Active users: ~5-10 simultáneos (equipo interno + stakeholders)
- Build frequency: ~50 builds/mes (CI/CD + feature branches)
- Database size: ~2 GB (datos de prueba, seed data)

---

## Desglose de Costos por Servicio

### 1. Amazon RDS PostgreSQL

| Concepto            | Configuración              | Costo unitario | Costo mensual |
| ------------------- | -------------------------- | -------------- | ------------- |
| **RDS Instance**    | db.t3.micro (730h/mes)     | $0.018/hora    | $13.14        |
| **Storage**         | 20 GB gp3                  | $0.115/GB/mes  | $2.30         |
| **IOPS**            | 3,000 IOPS gp3 (incluidos) | —              | $0.00         |
| **Backup Storage**  | ~5 GB promedio             | $0.095/GB/mes  | $0.48         |
| **Snapshot Export** | No aplica (staging)        | —              | $0.00         |
| **SUBTOTAL RDS**    |                            |                | **$15.92**    |

**⚠️ Free Tier (primeros 12 meses):**

- db.t3.micro: 750 horas/mes gratis → **$0.00**
- Storage: 20 GB gratis → **$0.00**
- Backup: 20 GB gratis → **$0.00**
- **SUBTOTAL RDS (Free Tier):** **$0.00**

---

### 2. RDS Proxy

| Concepto               | Configuración     | Costo unitario   | Costo mensual |
| ---------------------- | ----------------- | ---------------- | ------------- |
| **Proxy Endpoint**     | 1 vCPU (730h/mes) | $0.015/vCPU/hora | $10.95        |
| **Data Processed**     | ~10 GB/mes        | $0.10/GB         | $1.00         |
| **SUBTOTAL RDS Proxy** |                   |                  | **$11.95**    |

**💡 Nota:** RDS Proxy NO está cubierto por Free Tier.

---

### 3. AWS Amplify Hosting

| Concepto                  | Configuración                          | Costo unitario | Costo mensual |
| ------------------------- | -------------------------------------- | -------------- | ------------- |
| **Build Minutes**         | ~50 builds/mes × 3 min/build = 150 min | $0.01/min      | $1.50         |
| **Hosting (Data Served)** | ~10 GB/mes                             | $0.15/GB       | $1.50         |
| **Requests**              | ~100,000/mes                           | Incluido       | $0.00         |
| **SUBTOTAL Amplify**      |                                        |                | **$3.00**     |

**⚠️ Free Tier:**

- Build Minutes: 1,000 min/mes gratis → primeros 850 min gratis → costará solo ~$0.00 (dentro de Free Tier)
- Hosting: 15 GB/mes gratis → **$0.00**
- **SUBTOTAL Amplify (Free Tier):** **$0.00**

---

### 4. AWS Lambda (PostConfirmation)

| Concepto            | Configuración            | Costo unitario           | Costo mensual |
| ------------------- | ------------------------ | ------------------------ | ------------- |
| **Requests**        | ~200 registros/mes       | $0.20/1M requests        | $0.00         |
| **Compute Time**    | 200 × 0.5s × 512MB       | $0.0000166667/GB-segundo | $0.00         |
| **Data Transfer**   | Negligible (VPC interno) | —                        | $0.00         |
| **SUBTOTAL Lambda** |                          |                          | **$0.00**     |

**⚠️ Free Tier:**

- Requests: 1M gratis/mes → cubre 100%
- Compute: 400,000 GB-segundos gratis/mes → cubre 100%

---

### 5. Amazon Cognito

| Concepto                 | Configuración    | Costo unitario      | Costo mensual |
| ------------------------ | ---------------- | ------------------- | ------------- |
| **Monthly Active Users** | ~10 MAUs         | Gratis hasta 50,000 | $0.00         |
| **TOTP MFA**             | ~2 users con MFA | Gratis              | $0.00         |
| **Advanced Security**    | ~10 MAUs         | $0.05/MAU           | $0.50         |
| **SUBTOTAL Cognito**     |                  |                     | **$0.50**     |

**💡 Nota:** Advanced Security features (brute force protection, compromised credentials) cuestan $0.05/MAU.

---

### 6. Amazon S3 (Storage)

| Concepto                | Configuración                 | Costo unitario          | Costo mensual |
| ----------------------- | ----------------------------- | ----------------------- | ------------- |
| **S3 Standard Storage** | ~5 GB (logos, docs, invoices) | $0.023/GB/mes           | $0.12         |
| **PUT/POST Requests**   | ~1,000 requests/mes           | $0.005/1,000 requests   | $0.01         |
| **GET Requests**        | ~10,000 requests/mes          | $0.0004/1,000 requests  | $0.00         |
| **Data Transfer Out**   | ~1 GB/mes                     | $0.09/GB (después 10TB) | $0.09         |
| **SUBTOTAL S3**         |                               |                         | **$0.22**     |

**⚠️ Free Tier:**

- Storage: 5 GB gratis/mes → **$0.00**
- PUT: 2,000 requests gratis → **$0.00**
- GET: 20,000 requests gratis → **$0.00**
- **SUBTOTAL S3 (Free Tier):** **$0.00**

---

### 7. AWS Secrets Manager

| Concepto                     | Configuración                   | Costo unitario     | Costo mensual |
| ---------------------------- | ------------------------------- | ------------------ | ------------- |
| **Secret Storage**           | 2 secrets (rds/master, rds/app) | $0.40/secret/mes   | $0.80         |
| **API Calls**                | ~10,000 calls/mes               | $0.05/10,000 calls | $0.05         |
| **SUBTOTAL Secrets Manager** |                                 |                    | **$0.85**     |

---

### 8. Amazon CloudWatch

| Concepto                | Configuración     | Costo unitario    | Costo mensual |
| ----------------------- | ----------------- | ----------------- | ------------- |
| **Logs Ingestion**      | ~1 GB/mes         | $0.50/GB          | $0.50         |
| **Logs Storage**        | ~2 GB almacenados | $0.03/GB/mes      | $0.06         |
| **Custom Metrics**      | ~10 métricas      | $0.30/métrica/mes | $3.00         |
| **Alarms**              | ~5 alarmas        | $0.10/alarma/mes  | $0.50         |
| **SUBTOTAL CloudWatch** |                   |                   | **$4.06**     |

**⚠️ Free Tier:**

- Logs Ingestion: 5 GB gratis → cubre 100%
- Metrics: 10 custom metrics gratis → cubre 100%
- Alarms: 10 alarms gratis → cubre 100%
- **SUBTOTAL CloudWatch (Free Tier):** **$0.00**

---

### 9. Data Transfer (Inter-Service)

| Concepto                   | Configuración               | Costo unitario | Costo mensual |
| -------------------------- | --------------------------- | -------------- | ------------- |
| **Amplify → RDS Proxy**    | Mismo region (us-east-1)    | Gratis         | $0.00         |
| **RDS Proxy → RDS**        | Misma VPC                   | Gratis         | $0.00         |
| **Lambda → RDS Proxy**     | Misma VPC                   | Gratis         | $0.00         |
| **CloudFront → S3**        | (no configurado en staging) | —              | $0.00         |
| **SUBTOTAL Data Transfer** |                             |                | **$0.00**     |

---

## Resumen de Costos (Mensuales)

### Escenario 1: Cuenta Nueva (<12 meses) — Con Free Tier

| Servicio                    | Costo mensual         |
| --------------------------- | --------------------- |
| RDS PostgreSQL              | **$0.00** (Free Tier) |
| RDS Proxy                   | **$11.95**            |
| Amplify Hosting             | **$0.00** (Free Tier) |
| Lambda                      | **$0.00** (Free Tier) |
| Cognito (Advanced Security) | **$0.50**             |
| S3                          | **$0.00** (Free Tier) |
| Secrets Manager             | **$0.85**             |
| CloudWatch                  | **$0.00** (Free Tier) |
| Data Transfer               | **$0.00**             |
| **TOTAL**                   | **$13.30/mes** ✅     |

**💰 Presupuesto restante:** ~$36.70/mes para absorber overages o servicios adicionales (SES, SQS, EventBridge en futuras fases).

---

### Escenario 2: Cuenta Existente (>12 meses) — Sin Free Tier

| Servicio                    | Costo mensual                            |
| --------------------------- | ---------------------------------------- |
| RDS PostgreSQL              | **$15.92**                               |
| RDS Proxy                   | **$11.95**                               |
| Amplify Hosting             | **$3.00**                                |
| Lambda                      | **$0.00** (dentro de Free Tier perpetuo) |
| Cognito (Advanced Security) | **$0.50**                                |
| S3                          | **$0.22**                                |
| Secrets Manager             | **$0.85**                                |
| CloudWatch                  | **$4.06**                                |
| Data Transfer               | **$0.00**                                |
| **TOTAL**                   | **$36.50/mes** ✅                        |

**💰 Presupuesto restante:** ~$13.50/mes para absorber overages.

---

## Estrategias de Optimización de Costos

### 1. RDS Proxy (Mayor costo individual - $11.95/mes)

**Problema:** RDS Proxy es costoso para staging con bajo tráfico.

**Opciones:**

| Estrategia                                               | Ahorro                | Trade-off                                                      |
| -------------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| **A. Usar conexiones directas (sin Proxy)**              | -$11.95/mes           | ❌ Amplify/Lambda pueden agotar max_connections (100) en picos |
| **B. Implementar connection pooling en app (PgBouncer)** | -$11.95/mes           | ⚠️ Complejidad operacional (mantener PgBouncer container)      |
| **C. Mantener Proxy solo en prod**                       | -$11.95/mes (staging) | ✅ **Recomendado para staging** — usar directUrl en staging    |

**🎯 Recomendación:** Deshabilitar RDS Proxy en staging (solo producción). Esto reduce costo staging a **$1.35/mes con Free Tier** o **$24.55/mes sin Free Tier**.

### 2. CloudWatch (Segundo mayor costo - $4.06/mes sin Free Tier)

**Opciones:**

| Estrategia                             | Ahorro     | Trade-off                     |
| -------------------------------------- | ---------- | ----------------------------- |
| **A. Reducir custom metrics a 5**      | -$1.50/mes | ⚠️ Menos visibilidad          |
| **B. Reducir alarmas a 3 críticas**    | -$0.20/mes | ⚠️ Menos cobertura de alertas |
| **C. Reducir logs retention a 3 días** | -$0.03/mes | ✅ Aceptable para staging     |

**🎯 Recomendación:** Aplicar las 3 estrategias → ahorro de ~$1.73/mes.

### 3. Cognito Advanced Security ($0.50/mes)

**Opciones:**

| Estrategia                                       | Ahorro     | Trade-off                                           |
| ------------------------------------------------ | ---------- | --------------------------------------------------- |
| **A. Deshabilitar Advanced Security en staging** | -$0.50/mes | ⚠️ Staging vulnerable a brute force (bajo riesgo)   |
| **B. Mantener habilitado**                       | $0.00      | ✅ **Recomendado** — validar features antes de prod |

**🎯 Recomendación:** Mantener habilitado en staging para paridad con producción.

---

## Costos Proyectados (Optimizado)

### Escenario 3: Staging Optimizado (Sin RDS Proxy, Logs reducidos)

| Servicio                    | Costo mensual                    |
| --------------------------- | -------------------------------- |
| RDS PostgreSQL              | **$15.92** ($0.00 con Free Tier) |
| ~~RDS Proxy~~               | ~~$11.95~~ → **$0.00** ✅        |
| Amplify Hosting             | **$3.00** ($0.00 con Free Tier)  |
| Lambda                      | **$0.00**                        |
| Cognito (Advanced Security) | **$0.50**                        |
| S3                          | **$0.22** ($0.00 con Free Tier)  |
| Secrets Manager             | **$0.85**                        |
| CloudWatch (optimizado)     | **$2.33** ($0.00 con Free Tier)  |
| Data Transfer               | **$0.00**                        |
| **TOTAL (con Free Tier)**   | **$1.35/mes** ✅                 |
| **TOTAL (sin Free Tier)**   | **$22.82/mes** ✅                |

**💰 Presupuesto restante (sin Free Tier):** ~$27.18/mes para producción o servicios futuros.

---

## Proyección de Costos Futuros (Fase 2-4)

Cuando se agreguen servicios adicionales en fases futuras:

| Servicio                                       | Fase     | Costo estimado/mes                          |
| ---------------------------------------------- | -------- | ------------------------------------------- |
| **Amazon SES** (emails transaccionales)        | Fase 3   | $0.10 (dentro de Free Tier: 62k emails/mes) |
| **AWS SQS** (colas de trabajo)                 | Fase 3   | $0.00 (1M requests gratis/mes)              |
| **EventBridge Scheduler** (tareas programadas) | Fase 3   | $1.00 (invocaciones)                        |
| **AWS WAF** (firewall)                         | Fase 4   | $5.00 (Web ACL + rules)                     |
| **AWS Shield Standard**                        | Incluido | $0.00                                       |
| **GuardDuty** (threat detection)               | Fase 4   | $3.00 (primeros 30 días gratis)             |
| **TOTAL Servicios Adicionales**                |          | **~$9.10/mes**                              |

**📊 Proyección completa (Fase 4, sin Free Tier):**

- Staging optimizado: **$22.82/mes**
- Servicios adicionales: **$9.10/mes**
- **TOTAL:** **$31.92/mes** ✅ (dentro de presupuesto $50/mes)

---

## Alertas de Presupuesto Recomendadas

Configurar AWS Budgets con las siguientes alertas:

| Umbral      | Acción                                                |
| ----------- | ----------------------------------------------------- |
| **$15/mes** | 📧 Email de notificación → revisar uso                |
| **$25/mes** | 🚨 Email + Slack → investigar overage                 |
| **$40/mes** | 🔴 Email + Slack + JIRA ticket → acción inmediata     |
| **$50/mes** | ⛔ Hard limit → **deshabilitar recursos no críticos** |

---

## Comandos AWS CLI para Monitoreo de Costos

```powershell
# Ver costos del mes actual
aws ce get-cost-and-usage `
  --time-period Start=2026-03-01,End=2026-03-31 `
  --granularity MONTHLY `
  --metrics UnblendedCost `
  --group-by Type=DIMENSION,Key=SERVICE

# Ver forecast del próximo mes
aws ce get-cost-forecast `
  --time-period Start=2026-04-01,End=2026-04-30 `
  --granularity MONTHLY `
  --metric UNBLENDED_COST

# Crear budget alert
aws budgets create-budget `
  --account-id 155326049791 `
  --budget file://budget-config.json `
  --notifications-with-subscribers file://budget-notifications.json
```

---

## Conclusión

**✅ El presupuesto de $50/mes es factible** para staging + producción con las siguientes consideraciones:

1. **Free Tier (primeros 12 meses):** Staging costará ~$1.35/mes (excelente)
2. **Sin Free Tier:** Staging optimizado costará ~$22.82/mes
3. **Con servicios futuros (Fase 4):** Total proyectado ~$31.92/mes
4. **Presupuesto restante:** ~$18.08/mes para producción u overages

**🎯 Recomendaciones clave:**

- **Deshabilitar RDS Proxy en staging** (ahorro de $11.95/mes)
- **Reducir logs CloudWatch retention** en staging (ahorro de $1.73/mes)
- **Mantener Cognito Advanced Security** para paridad con producción
- **Monitorear costos semanalmente** con AWS Cost Explorer
- **Configurar AWS Budgets** con alertas en $15, $25, $40, $50

---

**Última actualización:** 15 marzo 2026  
**Próxima revisión:** Después del primer mes de uso real (abril 2026)  
**Responsable:** DevOps Team
