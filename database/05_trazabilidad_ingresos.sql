-- ============================================================
-- 05_trazabilidad_ingresos.sql
--
-- Trazabilidad de las hospitalizaciones: quien registro cada
-- ingreso, quien dio el alta y cuando se creo el registro.
--
--   registrado_por -> usuario (JWT) que creo el ingreso
--   alta_por       -> usuario (JWT) que dio el alta
--   creado_en      -> instante en que se inserto la fila
--
-- Los valores los pone el SERVIDOR a partir del JWT; el cliente
-- no puede enviarlos.
--
-- Es IDEMPOTENTE y NO borra datos. Requiere haber ejecutado
-- 04_migracion_especificacion.sql. Los ingresos anteriores a esta
-- migracion quedan con registrado_por / alta_por en NULL.
-- ============================================================

BEGIN;

ALTER TABLE public.ingresos
    ADD COLUMN IF NOT EXISTS registrado_por BIGINT
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS alta_por BIGINT
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ
        NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ingresos_registrado_por
    ON public.ingresos(registrado_por);

CREATE INDEX IF NOT EXISTS idx_ingresos_alta_por
    ON public.ingresos(alta_por);

COMMIT;
