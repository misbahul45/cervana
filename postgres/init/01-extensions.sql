# =================================================================
# CERVANA — Postgres init scripts (production)
# File di folder ini akan dijalankan alfabetikal saat container
# pertama kali membuat cluster (volume kosong).
# =================================================================
#
# Contoh: enable extensions yang dibutuhkan Prisma / Cervana.
-- HNSW untuk vector ops (kalau Cervana nanti pakai pgvector)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Better random untuk UUID v4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigram untuk search teks ringan
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Citext untuk email case-insensitive (opsional, Cervana bisa handle di app)
-- CREATE EXTENSION IF NOT EXISTS "citext";