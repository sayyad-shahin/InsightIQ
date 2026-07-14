-- Creates the role + database InsightIQ expects (matches DATABASE_URL in .env:
--   postgresql+psycopg2://insightiq:insightiq@localhost:5432/insightiq
-- Run once after installing PostgreSQL, as the 'postgres' superuser:
--   psql -U postgres -f scripts/init-db.sql
-- (Alembic creates the tables afterwards via `alembic upgrade head`.)

DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'insightiq') THEN
      CREATE ROLE insightiq LOGIN PASSWORD 'insightiq';
   END IF;
END
$$;

SELECT 'CREATE DATABASE insightiq OWNER insightiq'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'insightiq')\gexec
