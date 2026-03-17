import { defineStorage } from '@aws-amplify/backend';

/**
 * NexoERP — Configuración de Almacenamiento (S3)
 *
 * Bucket para documentos de empresas:
 * - Logos de empresas
 * - Facturas PDF generadas
 * - Reportes exportados
 * - Archivos adjuntos
 *
 * Estructura de paths:
 *   {company_id}/logos/
 *   {company_id}/invoices/{year}/{month}/
 *   {company_id}/reports/{year}/
 *   {company_id}/attachments/
 *
 * Seguridad:
 * - Block Public Access habilitado
 * - Acceso solo via pre-signed URLs
 * - Aislamiento por empresa via paths + policies
 *
 * @see REQUIREMENTS.md §9.6 RS-ENC-03, RS-ENC-04
 */
export const storage = defineStorage({
  name: 'nexoerpDocuments',
  access: (allow) => ({
    // Logos de empresa: el owner puede subir/leer, auth users pueden leer
    // Nota: {entity_id} DEBE estar justo antes del /* según Amplify Gen 2 requirements
    'logos/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.authenticated.to(['read']),
    ],
    // Documentos protegidos por empresa (facturas, reportes)
    // El acceso real se controla en la API verificando company_id del JWT
    'documents/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
    // Archivos temporales para import/export
    'temp/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
  }),
});
