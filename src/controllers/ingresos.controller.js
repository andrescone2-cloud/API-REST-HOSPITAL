const { matchedData } = require("express-validator");

const ingresosService = require("../services/ingresos.service");

// ========================================
// Errores PostgreSQL
// ========================================

const manejarErrorBD = (error, res, next) => {
  // Indices unicos de "un ingreso activo": respaldo de las
  // verificaciones de la transaccion ante peticiones simultaneas.
  if (error.code === "23505") {
    return res.status(409).json({
      mensaje:
        "La habitación o el paciente ya tienen un ingreso activo"
    });
  }

  if (error.code === "23503") {
    return res.status(409).json({
      mensaje: "La operación incumple una relación de la base de datos"
    });
  }

  if (["23502", "23514", "22P02"].includes(error.code)) {
    return res.status(400).json({
      mensaje: "Los datos del ingreso no son válidos"
    });
  }

  return next(error);
};

// ========================================
// GET /api/ingresos[?activo=true|false]
// ========================================

const obtenerIngresos = async (req, res, next) => {
  try {
    let filtro = null;

    if (req.query.activo !== undefined) {
      filtro = String(req.query.activo).toLowerCase() === "true"
        || req.query.activo === "1";
    }

    const ingresos = await ingresosService.obtenerIngresos(filtro);

    return res.status(200).json(ingresos);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET /api/ingresos/:id
// ========================================

const obtenerIngresoPorId = async (req, res, next) => {
  try {
    const ingreso = await ingresosService.obtenerIngresoPorId(
      req.params.id
    );

    if (!ingreso) {
      return res.status(404).json({
        mensaje: "Ingreso no encontrado"
      });
    }

    return res.status(200).json(ingreso);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// POST /api/ingresos
// ========================================

const crearIngreso = async (req, res, next) => {
  try {
    // matchedData: solo pacienteId, habitacionId,
    // fechaIngreso y diagnostico (anti Mass Assignment).
    const datos = matchedData(req, { locations: ["body"] });

    // Trazabilidad: quien registra sale del JWT (req.usuario),
    // no del cuerpo de la peticion.
    const resultado = await ingresosService.crearIngreso(
      datos,
      req.usuario?.id ?? null
    );

    if (!resultado.ok) {
      return res.status(resultado.status).json({
        mensaje: resultado.mensaje
      });
    }

    return res.status(201).json({
      mensaje: "Ingreso registrado correctamente",
      ingreso: resultado.ingreso
    });
  } catch (error) {
    return manejarErrorBD(error, res, next);
  }
};

// ========================================
// PATCH /api/ingresos/:id/dar-alta
// ========================================

const darAlta = async (req, res, next) => {
  try {
    const { fechaAlta } = matchedData(req, { locations: ["body"] });

    const resultado = await ingresosService.darAlta(
      req.params.id,
      fechaAlta ?? null,
      req.usuario?.id ?? null
    );

    if (!resultado.ok) {
      return res.status(resultado.status).json({
        mensaje: resultado.mensaje
      });
    }

    return res.status(200).json({
      mensaje: "Paciente dado de alta correctamente",
      ingreso: resultado.ingreso
    });
  } catch (error) {
    return manejarErrorBD(error, res, next);
  }
};

module.exports = {
  obtenerIngresos,
  obtenerIngresoPorId,
  crearIngreso,
  darAlta
};
