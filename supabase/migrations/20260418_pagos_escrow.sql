-- ═══════════════════════════════════════════════════════════════════════════
-- Sistema de Pagos con Escrow Suave — Fase 1
-- Diseño: docs/superpowers/specs/2026-04-18-sistema-pagos-escrow-design.md
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. CUIT del docente en verificaciones_usuario
ALTER TABLE verificaciones_usuario ADD COLUMN IF NOT EXISTS cuit TEXT;

-- 2. Nuevos estados en pagos
--    Anteriores: "approved" | "pending" | "rejected"
--    Nuevos:     "retenido" | "en_disputa" | "liberado" | "reembolsado"
--    (los anteriores se mantienen para compatibilidad con el webhook de MP)
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS estado_escrow TEXT DEFAULT 'pendiente';
  -- "pendiente"   → pago MP aprobado, clase aún no finalizada
  -- "retenido"    → clase finalizada, esperando 72hs sin disputa
  -- "en_disputa"  → alumno disputó, admin interviniendo
  -- "liberado"    → split ejecutado al docente
  -- "reembolsado" → disputa resuelta a favor del alumno

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS clase_finalizada_at TIMESTAMPTZ;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS liberado_at TIMESTAMPTZ;

-- 3. Tabla de disputas
CREATE TABLE IF NOT EXISTS disputas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id         UUID REFERENCES pagos(id) NOT NULL,
  inscripcion_id  UUID,
  alumno_email    TEXT NOT NULL,
  docente_email   TEXT NOT NULL,
  motivo          TEXT NOT NULL CHECK (motivo IN ('clase_no_dada', 'problema_calidad', 'otro')),
  descripcion     TEXT,
  estado          TEXT NOT NULL DEFAULT 'abierta'
                    CHECK (estado IN ('abierta', 'resuelta_alumno', 'resuelta_docente')),
  resolucion      TEXT,
  admin_email     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelto_at     TIMESTAMPTZ
);

-- 4. Tabla de liquidaciones mensuales
CREATE TABLE IF NOT EXISTS liquidaciones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docente_email       TEXT NOT NULL,
  periodo             TEXT NOT NULL,       -- formato "2026-04"
  monto_bruto         NUMERIC(12,2) NOT NULL,
  monto_neto          NUMERIC(12,2) NOT NULL,
  comision_luderis    NUMERIC(12,2) NOT NULL,
  cantidad_clases     INTEGER NOT NULL DEFAULT 0,
  pdf_url             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(docente_email, periodo)
);

-- 5. Índices útiles
CREATE INDEX IF NOT EXISTS idx_pagos_estado_escrow ON pagos(estado_escrow);
CREATE INDEX IF NOT EXISTS idx_pagos_clase_finalizada_at ON pagos(clase_finalizada_at);
CREATE INDEX IF NOT EXISTS idx_disputas_pago_id ON disputas(pago_id);
CREATE INDEX IF NOT EXISTS idx_disputas_estado ON disputas(estado);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_docente ON liquidaciones(docente_email, periodo);
