-- docker/postgres/init.sql
-- Script de inicialización para PostgreSQL 16
-- Se ejecuta automáticamente al crear el contenedor por primera vez

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- Generación de UUIDs (compatibilidad)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- gen_random_uuid() preferido (DAR-DBA)
CREATE EXTENSION IF NOT EXISTS "citext";          -- Texto case-insensitive (RTN, email)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Búsquedas fuzzy / LIKE optimizado
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- Soporte GIN para tipos btree (arrays)
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Análisis de rendimiento de queries

-- Configurar timezone por defecto
ALTER DATABASE nexoerp SET timezone TO 'America/Tegucigalpa';

-- Crear rol de aplicación (non-owner) para pruebas de RLS
-- El owner (nexoerp) bypasea RLS por defecto; app_role lo respeta
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nexoerp_app') THEN
    CREATE ROLE nexoerp_app LOGIN PASSWORD 'nexoerp_app_dev_2026';
  END IF;
END
$$;

-- Otorgar permisos al rol de aplicación
GRANT CONNECT ON DATABASE nexoerp TO nexoerp_app;
GRANT USAGE ON SCHEMA public TO nexoerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexoerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nexoerp_app;

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE 'NexoERP database initialized successfully';
  RAISE NOTICE 'Extensions: uuid-ossp, pgcrypto, citext, pg_trgm, btree_gin, pg_stat_statements';
  RAISE NOTICE 'Timezone: America/Tegucigalpa';
  RAISE NOTICE 'App role: nexoerp_app (respeta RLS para testing)';
END
$$;
