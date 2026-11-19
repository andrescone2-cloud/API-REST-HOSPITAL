const { pool, consultar } = require("../config/database");

// ========================================
// Columnas de salida
// ========================================

const columnas = `
  id,
  paciente_id AS "pacienteId",
  medico_id AS "medicoId",
  historial_id AS "historialId",
  fecha,
  indicaciones,
  estado,
  creado_por AS "creadoPor",
  creado_en AS "creadoEn"
`;

const columnasMedicamento = `
  id,
  receta_id AS "recetaId",
  medicamento,
  dosis,
  frecuencia,
  duracion_dias AS "duracionDias",
  instrucciones
`;

// ========================================
// Adjuntar los medicamentos a las recetas
// ========================================

const adjuntarMedicamentos = async (recetas) => {
  if (recetas.length === 0) {
    return recetas;
  }

  const ids = recetas.map((r) => r.id);

  const resultado = await consultar(
    `SELECT ${columnasMedicamento}
     FROM public.receta_medicamentos
     WHERE receta_id = ANY($1::bigint[])
     ORDER BY id`,
    [ids]
  );

  return recetas.map((receta) => ({
    ...receta,
    medicamentos: resultado.rows
      .filter((m) => String(m.recetaId) === String(receta.id))
      .map(({ recetaId, ...resto }) => resto)
  }));
};

// ========================================
// GET - Recetas (filtros opcionales)
// ========================================

const obtenerRecetas = async ({ pacienteId = null, estado = null } = {}) => {
  const condiciones = [];
  const valores = [];

  if (pacienteId != null) {
    valores.push(pacienteId);
    condiciones.push(`paciente_id = $${valores.length}`);
  }

  if (estado != null) {
    valores.push(estado);
    condiciones.push(`estado = $${valores.length}`);
  }

  const where = condiciones.length
    ? `WHERE ${condiciones.join(" AND ")}`
    : "";

  const resultado = await consultar(
    `SELECT ${columnas}
     FROM public.recetas
     ${where}
     ORDER BY fecha DESC, id DESC`,
    valores
  );

  return adjuntarMedicamentos(resultado.rows);
};

// ========================================
// GET - Receta por ID
// ========================================

const obtenerRecetaPorId = async (id) => {
  const resultado = await consultar(
    `SELECT ${columnas}
     FROM public.recetas
     WHERE id = $1`,
    [id]
  );

  if (resultado.rows.length === 0) {
    return null;
  }

  const [receta] = await adjuntarMedicamentos(resultado.rows);

  return receta;
};

// ========================================
// Integridad: paciente
// ========================================

const pacienteTieneRecetas = async (pacienteId) => {
  const resultado = await consultar(
    `SELECT EXISTS (
       SELECT 1
       FROM public.recetas
       WHERE paciente_id = $1
     ) AS existe`,
    [pacienteId]
  );

  return resultado.rows[0].existe;
};

// ========================================
// POST - Emitir receta
//
// Receta + medicamentos en UNA transaccion:
// o se guarda todo o no se guarda nada.
// ========================================

const crearReceta = async (datos, usuarioId = null) => {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const receta = await cliente.query(
      `INSERT INTO public.recetas (
         paciente_id,
         medico_id,
         historial_id,
         indicaciones,
         creado_por
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${columnas}`,
      [
        datos.pacienteId,
        datos.medicoId,
        datos.historialId ?? null,
        datos.indicaciones ?? null,
        usuarioId
      ]
    );

    const recetaId = receta.rows[0].id;

    for (const m of datos.medicamentos) {
      await cliente.query(
        `INSERT INTO public.receta_medicamentos (
           receta_id,
           medicamento,
           dosis,
           frecuencia,
           duracion_dias,
           instrucciones
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          recetaId,
          m.medicamento,
          m.dosis,
          m.frecuencia,
          m.duracionDias,
          m.instrucciones ?? null
        ]
      );
    }

    await cliente.query("COMMIT");

    return obtenerRecetaPorId(recetaId);
  } catch (error) {
    try {
      await cliente.query("ROLLBACK");
    } catch {
      // la conexion ya estaba rota; se libera abajo
    }
    throw error;
  } finally {
    cliente.release();
  }
};

// ========================================
// PATCH - Cambiar estado
//
// activa -> dispensada | anulada
// dispensada y anulada son finales.
// ========================================

const TRANSICIONES = {
  activa: ["dispensada", "anulada"],
  dispensada: [],
  anulada: []
};

const cambiarEstado = async (id, nuevoEstado) => {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const actual = await cliente.query(
      `SELECT id, estado
       FROM public.recetas
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (actual.rowCount === 0) {
      await cliente.query("ROLLBACK");
      return { ok: false, status: 404, mensaje: "Receta no encontrada" };
    }

    const estadoActual = actual.rows[0].estado;

    if (!TRANSICIONES[estadoActual].includes(nuevoEstado)) {
      await cliente.query("ROLLBACK");
      return {
        ok: false,
        status: 409,
        mensaje:
          `No se puede cambiar una receta de "${estadoActual}" a "${nuevoEstado}"`
      };
    }

    await cliente.query(
      `UPDATE public.recetas
       SET estado = $2
       WHERE id = $1`,
      [id, nuevoEstado]
    );

    await cliente.query("COMMIT");

    return { ok: true, receta: await obtenerRecetaPorId(id) };
  } catch (error) {
    try {
      await cliente.query("ROLLBACK");
    } catch {
      // la conexion ya estaba rota; se libera abajo
    }
    throw error;
  } finally {
    cliente.release();
  }
};

module.exports = {
  obtenerRecetas,
  obtenerRecetaPorId,
  pacienteTieneRecetas,
  crearReceta,
  cambiarEstado
};
