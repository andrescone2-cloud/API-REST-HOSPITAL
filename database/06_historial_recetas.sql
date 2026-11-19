-- ============================================================
-- 06_historial_recetas.sql
--
-- Historial medico y recetas medicas:
--
--   historial_medico     -> una fila por atencion/consulta de un paciente
--   recetas              -> receta emitida por un medico a un paciente
--   receta_medicamentos  -> medicamentos de cada receta (1..N)
--
-- Reglas de integridad:
--   * el historial NO se borra ni se edita desde la API (solo se agrega)
--   * una receta tiene al menos un medicamento (lo exige la API)
--   * estados de receta: activa -> dispensada | anulada
--   * paciente y medico no se pueden eliminar si tienen historial
--     o recetas (ON DELETE RESTRICT)
--
-- Es IDEMPOTENTE y NO borra datos. Requiere haber ejecutado
-- 04_migracion_especificacion.sql y 05_trazabilidad_ingresos.sql.
-- ============================================================

BEGIN;

-- ========================================
-- HISTORIAL MEDICO
-- ========================================
CREATE TABLE IF NOT EXISTS public.historial_medico (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    paciente_id BIGINT NOT NULL
        REFERENCES public.pacientes(id)
        ON DELETE RESTRICT,

    medico_id BIGINT NOT NULL
        REFERENCES public.medicos(id)
        ON DELETE RESTRICT,

    cita_id BIGINT
        REFERENCES public.citas(id)
        ON DELETE SET NULL,

    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    motivo_consulta VARCHAR(300) NOT NULL,
    diagnostico VARCHAR(500) NOT NULL,
    tratamiento VARCHAR(1000),
    observaciones VARCHAR(1000),

    creado_por BIGINT
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_historial_motivo
        CHECK (LENGTH(TRIM(motivo_consulta)) BETWEEN 3 AND 300),

    CONSTRAINT ck_historial_diagnostico
        CHECK (LENGTH(TRIM(diagnostico)) BETWEEN 3 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_historial_paciente
    ON public.historial_medico(paciente_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_historial_medico
    ON public.historial_medico(medico_id);

CREATE INDEX IF NOT EXISTS idx_historial_cita
    ON public.historial_medico(cita_id);

-- ========================================
-- RECETAS
-- ========================================
CREATE TABLE IF NOT EXISTS public.recetas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    paciente_id BIGINT NOT NULL
        REFERENCES public.pacientes(id)
        ON DELETE RESTRICT,

    medico_id BIGINT NOT NULL
        REFERENCES public.medicos(id)
        ON DELETE RESTRICT,

    historial_id BIGINT
        REFERENCES public.historial_medico(id)
        ON DELETE SET NULL,

    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    indicaciones VARCHAR(500),

    estado VARCHAR(20) NOT NULL DEFAULT 'activa',

    creado_por BIGINT
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_recetas_estado
        CHECK (estado IN ('activa', 'dispensada', 'anulada'))
);

CREATE INDEX IF NOT EXISTS idx_recetas_paciente
    ON public.recetas(paciente_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_recetas_medico
    ON public.recetas(medico_id);

CREATE INDEX IF NOT EXISTS idx_recetas_historial
    ON public.recetas(historial_id);

-- ========================================
-- MEDICAMENTOS DE LA RECETA
-- ========================================
CREATE TABLE IF NOT EXISTS public.receta_medicamentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    receta_id BIGINT NOT NULL
        REFERENCES public.recetas(id)
        ON DELETE CASCADE,

    medicamento VARCHAR(100) NOT NULL,
    dosis VARCHAR(50) NOT NULL,
    frecuencia VARCHAR(50) NOT NULL,
    duracion_dias INTEGER NOT NULL,
    instrucciones VARCHAR(300),

    CONSTRAINT ck_receta_med_duracion
        CHECK (duracion_dias BETWEEN 1 AND 365),

    CONSTRAINT ck_receta_med_nombre
        CHECK (LENGTH(TRIM(medicamento)) BETWEEN 2 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_receta_med_receta
    ON public.receta_medicamentos(receta_id);

-- ========================================
-- Seguridad: igual que las demas tablas
-- ========================================
ALTER TABLE public.historial_medico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receta_medicamentos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.historial_medico,
    public.recetas,
    public.receta_medicamentos
FROM anon, authenticated;

COMMIT;
