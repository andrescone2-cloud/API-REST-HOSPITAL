const { matchedData } = require("express-validator");

const habitacionesService = require("../services/habitaciones.service");

// ========================================
// Errores PostgreSQL
// ========================================

const manejarErrorBD = (error, res, next) => {
  if (error.code === "23505") {
    return res.status(409).json({
      mensaje: "Ya existe una habitación con ese número"
    });
  }

  if (["23502", "23514", "22P02"].includes(error.code)) {
    return res.status(400).json({
      mensaje: "Los datos de la habitación no son válidos"
    });
  }

  return next(error);
};

// ========================================
// GET /api/habitaciones
// ========================================

const obtenerHabitaciones = async (req, res, next) => {
  try {
    const habitaciones = await habitacionesService.obtenerHabitaciones();

    return res.status(200).json(habitaciones);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET /api/habitaciones/disponibles
// ========================================

const obtenerHabitacionesDisponibles = async (req, res, next) => {
  try {
    const habitaciones =
      await habitacionesService.obtenerHabitacionesDisponibles();

    return res.status(200).json(habitaciones);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET /api/habitaciones/:id
// ========================================

const obtenerHabitacionPorId = async (req, res, next) => {
  try {
    const habitacion = await habitacionesService.obtenerHabitacionPorId(
      req.params.id
    );

    if (!habitacion) {
      return res.status(404).json({
        mensaje: "Habitación no encontrada"
      });
    }

    return res.status(200).json(habitacion);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// POST /api/habitaciones
// ========================================

const crearHabitacion = async (req, res, next) => {
  try {
    const datos = matchedData(req, { locations: ["body"] });

    // "ocupada" la fija el sistema al registrar un ingreso;
    // crear una habitación ya ocupada la dejaría sin ingreso.
    if (datos.estado === "ocupada") {
      return res.status(409).json({
        mensaje:
          "Una habitación pasa a ocupada al registrar un ingreso, no al crearla"
      });
    }

    const existente = await habitacionesService.buscarHabitacionPorNumero(
      datos.numero
    );

    if (existente) {
      return res.status(409).json({
        mensaje: "Ya existe una habitación con ese número"
      });
    }

    const habitacion = await habitacionesService.crearHabitacion(datos);

    return res.status(201).json({
      mensaje: "Habitación creada correctamente",
      habitacion
    });
  } catch (error) {
    return manejarErrorBD(error, res, next);
  }
};

// ========================================
// PUT /api/habitaciones/:id
// ========================================

const actualizarHabitacion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const datos = matchedData(req, { locations: ["body"] });

    const actual = await habitacionesService.obtenerHabitacionPorId(id);

    if (!actual) {
      return res.status(404).json({
        mensaje: "Habitación no encontrada"
      });
    }

    const duplicada = await habitacionesService.buscarHabitacionPorNumero(
      datos.numero
    );

    if (duplicada && String(duplicada.id) !== String(id)) {
      return res.status(409).json({
        mensaje: "Ya existe una habitación con ese número"
      });
    }

    // El estado "ocupada" refleja un ingreso activo: ni se puede
    // fijar a mano sin ingreso, ni quitar mientras lo haya.
    const ocupadaPorIngreso =
      await habitacionesService.habitacionTieneIngresoActivo(id);

    if (ocupadaPorIngreso && datos.estado !== "ocupada") {
      return res.status(409).json({
        mensaje:
          "La habitación tiene un ingreso activo; debe darse de alta al paciente antes de cambiar su estado"
      });
    }

    if (!ocupadaPorIngreso && datos.estado === "ocupada") {
      return res.status(409).json({
        mensaje:
          "Una habitación pasa a ocupada al registrar un ingreso, no manualmente"
      });
    }

    const habitacion = await habitacionesService.actualizarHabitacion(
      id,
      datos
    );

    if (!habitacion) {
      return res.status(404).json({
        mensaje: "Habitación no encontrada"
      });
    }

    return res.status(200).json({
      mensaje: "Habitación actualizada correctamente",
      habitacion
    });
  } catch (error) {
    return manejarErrorBD(error, res, next);
  }
};

module.exports = {
  obtenerHabitaciones,
  obtenerHabitacionesDisponibles,
  obtenerHabitacionPorId,
  crearHabitacion,
  actualizarHabitacion
};
