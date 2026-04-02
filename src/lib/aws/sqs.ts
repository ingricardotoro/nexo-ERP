/**
 * SQS utility — encola trabajos de generación de PDF de facturas (F3-09)
 *
 * Uso en publish route:
 *   await enqueueInvoicePdf({ invoiceId, companyId, invoiceNumber });
 *
 * En dev (AMPLIFY_ENV=local / SQS_QUEUE_URL_INVOICE_PDF no definida):
 *   Solo loguea un warning y retorna — la factura queda publicada sin PDF.
 *   El PDF se puede regenerar manualmente cuando el entorno tenga SQS.
 */

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export interface InvoicePdfJob {
  invoiceId: string;
  companyId: string;
  invoiceNumber: string;
}

const sqsClient = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

/**
 * Encola la generación de PDF para una factura recién publicada.
 * Lanza si SQS falla — el llamador debe decidir si propagar el error.
 *
 * @throws Si SQS_QUEUE_URL_INVOICE_PDF está definida y el envío falla.
 */
export async function enqueueInvoicePdf(job: InvoicePdfJob): Promise<void> {
  const queueUrl = process.env.SQS_QUEUE_URL_INVOICE_PDF;

  if (!queueUrl) {
    // En local dev la cola no existe — loguear y seguir (PDF se omite)
    console.warn('[SQS] SQS_QUEUE_URL_INVOICE_PDF not set — skipping PDF enqueue', {
      invoiceId: job.invoiceId,
      invoiceNumber: job.invoiceNumber,
    });
    return;
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(job),
      MessageAttributes: {
        invoiceId: { DataType: 'String', StringValue: job.invoiceId },
        companyId: { DataType: 'String', StringValue: job.companyId },
      },
    }),
  );

  console.info('[SQS] Invoice PDF job enqueued', {
    invoiceId: job.invoiceId,
    invoiceNumber: job.invoiceNumber,
  });
}
