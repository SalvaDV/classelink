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

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — Row Level Security para nuevas tablas
-- ═══════════════════════════════════════════════════════════════════════════

-- Disputas: el alumno y el docente involucrados pueden ver sus disputas
ALTER TABLE disputas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputas_propia" ON disputas
  FOR SELECT USING (
    auth.jwt() ->> 'email' = alumno_email
    OR auth.jwt() ->> 'email' = docente_email
  );
CREATE POLICY "disputas_insert_alumno" ON disputas
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = alumno_email);

-- Liquidaciones: solo el docente puede ver sus liquidaciones
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liquidaciones_propia" ON liquidaciones
  FOR SELECT USING (auth.jwt() ->> 'email' = docente_email);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Trigger: cuando inscripcion.clase_finalizada = true →
--    actualizar pago correspondiente a estado_escrow = "retenido"
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_inscripcion_finalizada()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Solo actúa cuando clase_finalizada cambia a true
  IF NEW.clase_finalizada = true AND (OLD.clase_finalizada IS NULL OR OLD.clase_finalizada = false) THEN
    UPDATE pagos
    SET
      estado_escrow      = 'retenido',
      clase_finalizada_at = NOW()
    WHERE
      publicacion_id = NEW.publicacion_id
      AND alumno_email  = NEW.alumno_email
      AND estado        = 'approved'
      AND estado_escrow = 'pendiente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inscripcion_finalizada ON inscripciones;
CREATE TRIGGER trg_inscripcion_finalizada
  AFTER UPDATE OF clase_finalizada ON inscripciones
  FOR EACH ROW EXECUTE FUNCTION fn_inscripcion_finalizada();

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Función de liberación automática (invocada por pg_cron)
--    Libera pagos "retenidos" con más de 72hs sin disputa
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_liberar_pagos_vencidos()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  liberados INTEGER;
BEGIN
  UPDATE pagos
  SET
    estado_escrow = 'liberado',
    liberado_at   = NOW()
  WHERE
    estado_escrow       = 'retenido'
    AND clase_finalizada_at < NOW() - INTERVAL '72 hours';

  GET DIAGNOSTICS liberados = ROW_COUNT;
  RETURN liberados;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. pg_cron: job diario que libera pagos vencidos (requiere extensión pg_cron)
--    Activa pg_cron desde el Dashboard de Supabase → Extensions antes de correr esto.
-- ═══════════════════════════════════════════════════════════════════════════
-- Eliminar job anterior si existe
SELECT cron.unschedule('liberar_pagos_vencidos') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'liberar_pagos_vencidos'
);

-- Crear job: corre todos los días a las 03:00 UTC
SELECT cron.schedule(
  'liberar_pagos_vencidos',
  '0 3 * * *',
  $$ SELECT fn_liberar_pagos_vencidos(); $$
);
