/**
 * Structured Logger — NexoERP (F6-01)
 *
 * Emite JSON a stdout para que CloudWatch Logs Insights pueda indexar
 * los campos y crear métricas/alarmas sin un agente adicional.
 *
 * Formato:
 * {
 *   "level": "info"|"warn"|"error",
 *   "timestamp": "2026-04-08T00:00:00.000Z",
 *   "service": "nexoerp-api",
 *   "requestId": "...",   // opcional
 *   "companyId": "...",   // enmascarado: solo primeros 8 chars
 *   "method": "GET",
 *   "path": "/api/v1/...",
 *   "statusCode": 200,
 *   "durationMs": 42,
 *   "message": "...",
 *   "error": "..."        // solo en error
 * }
 *
 * En desarrollo imprime JSON formateado; en producción una línea por evento
 * para compatibilidad con CloudWatch.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  /** Solo los primeros 8 caracteres del UUID para evitar PII en logs */
  companyId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, context: LogContext = {}): void {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    service: 'nexoerp-api',
    message,
    // Enmascarar companyId: solo primeros 8 chars (no PII completo en logs)
    ...(context.companyId
      ? { ...context, companyId: context.companyId.slice(0, 8) + '...' }
      : context),
  };

  const output =
    process.env.NODE_ENV === 'production' ? JSON.stringify(entry) : JSON.stringify(entry, null, 2);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),

  /**
   * Helper para loguear el resultado de un API route.
   * Uso: logger.request(request, response, durationMs, companyId?)
   */
  request: (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    companyId?: string,
    requestId?: string,
  ) => {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    emit(level, `${method} ${path} ${statusCode}`, {
      method,
      path,
      statusCode,
      durationMs,
      companyId,
      requestId,
    });
  },
};
