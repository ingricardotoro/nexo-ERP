import { defineBackend } from '@aws-amplify/backend';
import { Duration, CfnOutput } from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { auth } from './auth/resource.js';
import { storage } from './storage/resource.js';
import { postConfirmation } from './functions/post-confirmation/resource.js';
import { generateInvoicePdf } from './functions/generate-invoice-pdf/resource.js';

/**
 * NexoERP — Backend Definition (Amplify Gen 2)
 *
 * Recursos:
 * - Auth: Cognito User Pool con 5 roles RBAC
 * - Storage: S3 para documentos de empresas
 * - postConfirmation: Lambda Cognito trigger (sincroniza users a PostgreSQL)
 * - generateInvoicePdf: Lambda SQS trigger (genera PDFs de facturas F3-09)
 *
 * @see https://docs.amplify.aws/gen2/build-a-backend/
 */
const backend = defineBackend({
  auth,
  storage,
  postConfirmation,
  generateInvoicePdf,
});

// === Tags del proyecto ===
const mainStack = backend.createStack('NexoERPStack');
mainStack.tags.setTag('Project', 'NexoERP');
mainStack.tags.setTag('Environment', process.env.AMPLIFY_ENV || 'sandbox');

// ─── F3-09: SQS Queue para generación de PDFs de facturas ──────────────────
const invoicePdfStack = backend.createStack('InvoicePDFStack');
invoicePdfStack.tags.setTag('Project', 'NexoERP');
invoicePdfStack.tags.setTag('Module', 'Invoicing-PDF');

// Dead-Letter Queue: mensajes que fallaron 3 veces quedan aquí para inspección
const invoicePdfDlq = new sqs.Queue(invoicePdfStack, 'InvoicePDFDlq', {
  queueName: `nexoerp-invoice-pdf-dlq-${process.env.AMPLIFY_ENV ?? 'sandbox'}`,
  retentionPeriod: Duration.days(14),
});

// Cola principal: visibilityTimeout >= Lambda timeout (120 seg)
const invoicePdfQueue = new sqs.Queue(invoicePdfStack, 'InvoicePDFQueue', {
  queueName: `nexoerp-invoice-pdf-${process.env.AMPLIFY_ENV ?? 'sandbox'}`,
  visibilityTimeout: Duration.seconds(180),
  retentionPeriod: Duration.days(4),
  deadLetterQueue: {
    queue: invoicePdfDlq,
    maxReceiveCount: 3,
  },
});

// Adjuntar SQS como event source de la Lambda (batch=1 — un PDF por invocación)
backend.generateInvoicePdf.resources.lambda.addEventSource(
  new lambdaEventSources.SqsEventSource(invoicePdfQueue, {
    batchSize: 1,
    maxConcurrency: 5,
  }),
);

// Conceder permisos de lectura/borrado en la cola a la Lambda (event source los agrega
// automáticamente, pero dejamos explícito para claridad de IAM)
invoicePdfQueue.grantConsumeMessages(backend.generateInvoicePdf.resources.lambda);

// Conceder a la Lambda permiso de escritura en el bucket de documentos
const documentsBucket = s3.Bucket.fromBucketName(
  invoicePdfStack,
  'DocumentsBucket',
  process.env.S3_BUCKET_DOCUMENTS ??
    'amplify-nexoerp-marvin-sa-nexoerpdocumentsbucketb8-bimtcqkqm8s3',
);
documentsBucket.grantPut(backend.generateInvoicePdf.resources.lambda);

// Exportar la URL de la cola para usarla en la aplicación Next.js
new CfnOutput(invoicePdfStack, 'InvoicePDFQueueUrl', {
  value: invoicePdfQueue.queueUrl,
  description: 'SQS Queue URL para generación de PDFs de facturas (F3-09)',
  exportName: `NexoERP-InvoicePDFQueueUrl-${process.env.AMPLIFY_ENV ?? 'sandbox'}`,
});
