# NexoERP

[![CI Pipeline](https://github.com/ingricardotoro/nexo-ERP/actions/workflows/ci.yml/badge.svg)](https://github.com/ingricardotoro/nexo-ERP/actions/workflows/ci.yml)

Sistema ERP modular para PYMEs hondureñas.

## Stack Tecnológico

- **Frontend:** Next.js 15 + React 19 + TypeScript 5 + Tailwind CSS 4
- **Backend:** Next.js API Routes + Prisma ORM 6
- **Base de datos:** PostgreSQL 16
- **Infraestructura:** AWS Amplify Gen 2 + RDS + S3 + Cognito
- **UI:** shadcn/ui + Radix UI

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env.local

# Levantar servidor de desarrollo
npm run dev
```

## Estructura del Proyecto

Ver documentación arquitectónica completa en [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentación

- [REQUIREMENTS.md](docs/REQUIREMENTS.md) - Especificación completa del proyecto
- [Specs Fase 0](docs/specs/fase-0/) - Especificaciones técnicas de la fase fundacional

## Licencia

Privado - Todos los derechos reservados
