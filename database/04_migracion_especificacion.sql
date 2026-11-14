-- ============================================================
-- 04_migracion_especificacion.sql
--
-- Ajusta el esquema existente a la especificacion del proyecto
-- "API REST para la gestion de un Hospital":
--
--   * pacientes   -> tipo_sangre, alergias
--   * medicos     -> documento (unico), estado
--   * citas       -> estado 'atendida' pasa a 'completada'
--   * habitaciones (nueva)
--   * ingresos     (nueva)
--
-- Es IDEMPOTENTE: se puede ejecutar mas de una vez.
-- No borra datos. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

BEGIN;

-- ========================================
-- PACIENTES: tipoSangre y alergias
-- ========================================
ALTER TABLE public.pacientes
    ADD COLUMN IF NOT EXISTS tipo_sangre VARCHAR(3),
    ADD COLUMN IF NOT EXISTS alergias TEXT;

ALTER TABLE public.pacientes
    DROP CONSTRAINT IF EXISTS ck_pacientes_tipo_sangre;

ALTER TABLE public.pacientes
    ADD CONSTRAINT ck_pacientes_tipo_sangre
    CHECK (
        tipo_sangre IS NULL
        OR tipo_sangre IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')
    );

-- ========================================
-- MEDICOS: documento unico y estado
-- ========================================
ALTER TABLE public.medicos
    ADD COLUMN IF NOT EXISTS documento VARCHAR(30),
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20);

-- Estado inicial coherente con la columna "activo" existente
UPDATE public.medicos
SET estado = CASE WHEN activo THEN 'activo' ELSE 'inactivo' END
WHERE estado IS NULL;

ALTER TABLE public.medicos
    ALTER COLUMN estado SET DEFAULT 'activo',
    ALTER COLUMN estado SET NOT NULL;

ALTER TABLE public.medicos
    DROP CONSTRAINT IF EXISTS ck_medicos_estado;

ALTER TABLE public.medicos
    ADD CONSTRAINT ck_medicos_estado
    CHECK (estado IN ('activo', 'inactivo', 'vacaciones'));

-- Los medicos ya registrados quedan con documento NULL hasta que
-- se les asigne uno (UNIQUE admite varios NULL). La API lo exige
-- en altas nuevas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_medicos_documento
    ON public.medicos(documento)
    WHERE documento IS NOT NULL;

-- ========================================
-- CITAS: 'atendida' -> 'completada'
-- ========================================
ALTER TABLE public.citas
    DROP CONSTRAINT IF EXISTS ck_citas_estado;

UPDATE public.citas
SET estado = 'completada'
WHERE estado = 'atendida';

ALTER TABLE public.citas
    ADD CONSTRAINT ck_citas_estado
    CHECK (
        estado IN (
            'programada',
            'confirmada',
            'completada',
            'cancelada'
        )
    );

-- ========================================
-- HABITACIONES
-- ========================================
CREATE TABLE IF NOT EXISTS public.habitaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    numero VARCHAR(10) NOT NULL UNIQUE,
    piso INTEGER NOT NULL,

    tipo VARCHAR(20) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',

    CONSTRAINT ck_habitaciones_tipo
        CHECK (tipo IN ('UCI', 'General', 'Aislamiento')),

    CONSTRAINT ck_habitaciones_estado
        CHECK (estado IN ('disponible', 'ocupada', 'mantenimiento')),

    CONSTRAINT ck_habitaciones_piso
        CHECK (piso BETWEEN -5 AND 100)
);

-- ========================================
-- INGRESOS / HOSPITALIZACIONES
-- ========================================
CREATE TABLE IF NOT EXISTS public.ingresos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    paciente_id BIGINT NOT NULL
        REFERENCES public.pacientes(id)
        ON DELETE RESTRICT,

    habitacion_id BIGINT NOT NULL
        REFERENCES public.habitaciones(id)
        ON DELETE RESTRICT,

    fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_alta TIMESTAMPTZ,

    diagnostico VARCHAR(500) NOT NULL,

    CONSTRAINT ck_ingresos_fechas
        CHECK (fecha_alta IS NULL OR fecha_alta >= fecha_ingreso),

    CONSTRAINT ck_ingresos_diagnostico
        CHECK (LENGTH(TRIM(diagnostico)) BETWEEN 3 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_ingresos_paciente
    ON public.ingresos(paciente_id);

CREATE INDEX IF NOT EXISTS idx_ingresos_habitacion
    ON public.ingresos(habitacion_id);

-- Maximo UN ingreso activo (sin alta) por habitacion...
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingresos_habitacion_activo
    ON public.ingresos(habitacion_id)
    WHERE fecha_alta IS NULL;

-- ...y un paciente no puede estar hospitalizado dos veces a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingresos_paciente_activo
    ON public.ingresos(paciente_id)
    WHERE fecha_alta IS NULL;

-- ========================================
-- Seguridad: igual que las demas tablas
-- ========================================
ALTER TABLE public.habitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingresos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.habitaciones,
    public.ingresos
FROM anon, authenticated;

COMMIT;
