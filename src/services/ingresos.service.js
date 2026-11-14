const { pool, consultar } = require("../config/database");

// ========================================
// Columnas de salida
// ========================================

const columnas = `
  id,
  paciente_id AS "pacienteId",
  habitacion_id AS "habitacionId",
  fecha_ingreso AS "fechaIngreso",
  fecha_alta AS "fechaAlta",
  diagnostico,
  registrado_por AS "registradoPor",
  alta_por AS "altaPor",
  creado_en AS "creadoEn"
`;

// ========================================
// GET - Ingresos
//
// filtroActivo: true  -> solo sin alta
//               false -> solo con alta
//               null  -> todos
// ========================================

const obtenerIngresos = async (filtroActivo = null) => {
  let condicion = "";

  if (filtroActivo === true) {
    condicion = "WHERE fecha_alta IS NULL";
  } else if (filtroActivo === false) {
    condicion = "WHERE fecha_alta IS NOT NULL";
  }

  const resultado = await consultar(`
    SELECT ${columnas}
    FROM public.ingresos
    ${condicion}
    ORDER BY fecha_ingreso DESC, id DESC
  `);

  return resultado.rows;
};

// ========================================
// GET - Ingreso por ID
// ========================================

const obtenerIngresoPorId = async (id) => {
  const resultado = await consultar(
    `SELECT ${columnas}
     FROM public.ingresos
     WHERE id = $1`,
    [id]
  );

  return resultado.rows[0] ?? null;
};

// ========================================
// Integridad: paciente
// ========================================

const pacienteTieneIngresoActivo = async (pacienteId) => {
  const resultado = await consultar(
    `SELECT EXISTS (
       SELECT 1
       FROM public.ingresos
       WHERE paciente_id = $1
         AND fecha_alta IS NULL
     ) AS existe`,
    [pacienteId]
  );

  return resultado.rows[0].existe;
};

const pacienteTieneIngresos = async (pacienteId) => {
  const resultado = await consultar(
    `SELECT EXISTS (
       SELECT 1
       FROM public.ingresos
       WHERE paciente_id = $1
     ) AS existe`,
    [pacienteId]
  );

  return resultado.rows[0].existe;
};

// ========================================
// POST - Registrar ingreso
//
// Todo en UNA transaccion:
//   1. el paciente existe
//   2. la habitacion existe y se BLOQUEA
//      (FOR UPDATE), asi dos ingresos
//      simultaneos no pueden tomarla a la vez
//   3. la habitacion esta disponible
//   4. el paciente no esta ya hospitalizado
//   5. se crea el ingreso
//   6. la habitacion pasa a 'ocupada'
//
// usuarioId: quien registra (viene del JWT, nunca
// del cuerpo de la peticion) -> registrado_por.
//
// Devuelve { ok: true, ingreso } o
// { ok: false, status, mensaje }.
// ========================================

const crearIngreso = async (datos, usuarioId = null) => {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const paciente = await cliente.query(
      "SELECT id FROM public.pacientes WHERE id = $1",
      [datos.pacienteId]
    );

    if (paciente.rowCount === 0) {
      await cliente.query("ROLLBACK");
      return {
        ok: false,
        status: 400,
        mensaje: "El paciente indicado no existe"
      };
    }

    const habitacion = await cliente.query(
      `SELECT id, estado
       FROM public.habitaciones
       WHERE id = $1
       FOR UPDATE`,
      [datos.habitacionId]
    );

    if (habitacion.rowCount === 0) {
      await cliente.query("ROLLBACK");
      return {
        ok: false,
        status: 400,
        mensaje: "La habitación indicada no existe"
      };
    }

    if (habitacion.rows[0].estado !== "disponible") {
      await cliente.query("ROLLBACK");
      return {
        ok: false,
        status: 409,
        mensaje:
          `La habitación no está disponible (estado: ${habitacion.rows[0].estado})`
      };
    }

    const activo = await cliente.query(
      `SELECT 1
       FROM public.ingresos
       WHERE paciente_id = $1
         AND fecha_alta IS NULL
       LIMIT 1`,
      [datos.pacienteId]
    );

    if (activo.rowCount > 0) {
      await cliente.query("ROLLBACK");
      return {
        ok: false,
        status: 409,
        mensaje: "El paciente ya tiene una hospitalización en curso"
      };
    }

    const ingreso = await cliente.query(
      `INSERT INTO public.ingresos (
         paciente_id,
         habitacion_id,
         fecha_ingreso,
         diagnostico,
         registrado_por
       )
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4, $5)
       RETURNING ${columnas}`,
      [
        datos.pacienteId,
        datos.habitacionId,
        datos.fechaIngreso ?? null,
        datos.diagnostico,
        usuarioId
      ]
    );

    await cliente.query(
      `UPDATE public.habitaciones
       SET estado = 'ocupada'
       WHERE id = $1`,
      [datos.habitacionId]
    );

    await cliente.query("COMMIT");

    return { ok: true, ingreso: ingreso.rows[0] };
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
// PATCH - Dar de alta
//
// Una transaccion:
//   1. bloquea el ingreso
//   2. verifica que siga activo
//   3. fechaAlta (o ahora) >= fechaIngreso
//   4. registra el alta y quien la dio (alta_por,
//      tomado del JWT)
//   5. la habitacion vuelve a 'disponible'
// ========================================

const darAlta = async (id, fechaAlta = null, usuarioId = null) => {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    const actual = await cliente.query(
      `SELECT id,
              habitacion_id,
              fecha_ingreso,
              fecha_alta
       FROM public.ingresos
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (actual.rowCount === 0) {
      await cliente.query("ROLLBACK");
      return {
        ok: false,
        status: 404,
        mensaje: "Ingreso no encontrado"
      };
    }

    const ingreso = actual.rows[0];

    if (ingreso.fecha_alta !== null) {
      await cliente.query("ROLLBACK");
      return {
        ok: false,
        status: 409,
        mensaje: "El paciente ya fue dado de alta en este ingreso"
      };
    }

    const instanteAlta =
      fechaAlta == null ? new Date() : new Date(fechaAlta);

    if (instanteAlta < ingreso.fecha_ingreso) {
      await cliente.query("ROLLBACK");
      return {
        ok: false,
        status: 400,
        mensaje:
          "La fecha de alta no puede ser anterior a la fecha de ingreso"
      };
    }

    const actualizado = await cliente.query(
      `UPDATE public.ingresos
       SET fecha_alta = $2,
           alta_por = $3
       WHERE id = $1
       RETURNING ${columnas}`,
      [id, instanteAlta, usuarioId]
    );

    await cliente.query(
      `UPDATE public.habitaciones
       SET estado = 'disponible'
       WHERE id = $1`,
      [ingreso.habitacion_id]
    );

    await cliente.query("COMMIT");

    return { ok: true, ingreso: actualizado.rows[0] };
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
  obtenerIngresos,
  obtenerIngresoPorId,
  pacienteTieneIngresoActivo,
  pacienteTieneIngresos,
  crearIngreso,
  darAlta
};
