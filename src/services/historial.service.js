const { consultar } = require("../config/database");

// ========================================
// Columnas de salida
// ========================================

const columnas = `
  id,
  paciente_id AS "pacienteId",
  medico_id AS "medicoId",
  cita_id AS "citaId",
  fecha,
  motivo_consulta AS "motivoConsulta",
  diagnostico,
  tratamiento,
  observaciones,
  creado_por AS "creadoPor",
  creado_en AS "creadoEn"
`;

// ========================================
// GET - Historial (todo o de un paciente)
// ========================================

const obtenerHistorial = async (pacienteId = null) => {
  if (pacienteId != null) {
    const resultado = await consultar(
      `SELECT ${columnas}
       FROM public.historial_medico
       WHERE paciente_id = $1
       ORDER BY fecha DESC, id DESC`,
      [pacienteId]
    );

    return resultado.rows;
  }

  const resultado = await consultar(
    `SELECT ${columnas}
     FROM public.historial_medico
     ORDER BY fecha DESC, id DESC`
  );

  return resultado.rows;
};

// ========================================
// GET - Entrada por ID
// ========================================

const obtenerEntradaPorId = async (id) => {
  const resultado = await consultar(
    `SELECT ${columnas}
     FROM public.historial_medico
     WHERE id = $1`,
    [id]
  );

  return resultado.rows[0] ?? null;
};

// ========================================
// Cita (para validar el vinculo)
// ========================================

const obtenerCitaBasica = async (id) => {
  const resultado = await consultar(
    `SELECT id,
            paciente_id AS "pacienteId"
     FROM public.citas
     WHERE id = $1`,
    [id]
  );

  return resultado.rows[0] ?? null;
};

// ========================================
// Integridad: paciente / medico
// ========================================

const pacienteTieneHistorial = async (pacienteId) => {
  const resultado = await consultar(
    `SELECT EXISTS (
       SELECT 1
       FROM public.historial_medico
       WHERE paciente_id = $1
     ) AS existe`,
    [pacienteId]
  );

  return resultado.rows[0].existe;
};

// ========================================
// POST - Agregar entrada al historial
//
// usuarioId viene del JWT (creado_por); el
// historial solo se agrega, no se edita ni
// se borra desde la API.
// ========================================

const crearEntrada = async (datos, usuarioId = null) => {
  const resultado = await consultar(
    `INSERT INTO public.historial_medico (
       paciente_id,
       medico_id,
       cita_id,
       fecha,
       motivo_consulta,
       diagnostico,
       tratamiento,
       observaciones,
       creado_por
     )
     VALUES (
       $1, $2, $3,
       COALESCE($4::timestamptz, NOW()),
       $5, $6, $7, $8, $9
     )
     RETURNING ${columnas}`,
    [
      datos.pacienteId,
      datos.medicoId,
      datos.citaId ?? null,
      datos.fecha ?? null,
      datos.motivoConsulta,
      datos.diagnostico,
      datos.tratamiento ?? null,
      datos.observaciones ?? null,
      usuarioId
    ]
  );

  return resultado.rows[0];
};

module.exports = {
  obtenerHistorial,
  obtenerEntradaPorId,
  obtenerCitaBasica,
  pacienteTieneHistorial,
  crearEntrada
};
