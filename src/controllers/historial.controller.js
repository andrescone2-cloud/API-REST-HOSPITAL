const { matchedData } = require("express-validator");

const historialService = require("../services/historial.service");
const pacientesService = require("../services/pacientes.service");
const { resolverMedicoEmisor, puedeVerPaciente } = require("../utils/clinico.util");

// ========================================
// Errores PostgreSQL
// ========================================

const manejarErrorBD = (error, res, next) => {
  if (error.code === "23503") {
    return res.status(409).json({
      mensaje: "La operación incumple una relación de la base de datos"
    });
  }

  if (["23502", "23514", "22P02"].includes(error.code)) {
    return res.status(400).json({
      mensaje: "Los datos del historial no son válidos"
    });
  }

  return next(error);
};

// ========================================
// GET /api/historial[?pacienteId=]
// Administrador y médico
// ========================================

const obtenerHistorial = async (req, res, next) => {
  try {
    const entradas = await historialService.obtenerHistorial(
      req.query.pacienteId ?? null
    );

    return res.status(200).json(entradas);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET /api/historial/paciente/:pacienteId
// Administrador, médico y el propio paciente
// ========================================

const obtenerHistorialDePaciente = async (req, res, next) => {
  try {
    const { pacienteId } = req.params;

    if (!(await puedeVerPaciente(req, pacienteId))) {
      return res.status(403).json({
        mensaje: "No tiene permisos para ver el historial de este paciente"
      });
    }

    const paciente = await pacientesService.obtenerPacientePorId(pacienteId);

    if (!paciente) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado"
      });
    }

    const entradas = await historialService.obtenerHistorial(pacienteId);

    return res.status(200).json(entradas);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET /api/historial/mi-historial
// Solo paciente: su propio historial
// (misma idea que /api/citas/mis-citas)
// ========================================

const obtenerMiHistorial = async (req, res, next) => {
  try {
    const paciente = await pacientesService.obtenerPacientePorUsuarioId(
      req.usuario.id
    );

    if (!paciente) {
      return res.status(404).json({
        mensaje: "Su usuario no está asociado a un paciente"
      });
    }

    const entradas = await historialService.obtenerHistorial(paciente.id);

    return res.status(200).json(entradas);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET /api/historial/:id
// ========================================

const obtenerEntrada = async (req, res, next) => {
  try {
    const entrada = await historialService.obtenerEntradaPorId(
      req.params.id
    );

    // Un paciente que pide el registro de otro recibe 404,
    // igual que si no existiera (no se revela su existencia).
    if (!entrada || !(await puedeVerPaciente(req, entrada.pacienteId))) {
      return res.status(404).json({
        mensaje: "Entrada de historial no encontrada"
      });
    }

    return res.status(200).json(entrada);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// POST /api/historial
// Administrador y médico
// ========================================

const crearEntrada = async (req, res, next) => {
  try {
    const datos = matchedData(req, { locations: ["body"] });

    const paciente = await pacientesService.obtenerPacientePorId(
      datos.pacienteId
    );

    if (!paciente) {
      return res.status(400).json({
        mensaje: "El paciente indicado no existe"
      });
    }

    const emisor = await resolverMedicoEmisor(req, datos.medicoId);

    if (!emisor.ok) {
      return res.status(emisor.status).json({ mensaje: emisor.mensaje });
    }

    if (datos.citaId != null) {
      const cita = await historialService.obtenerCitaBasica(datos.citaId);

      if (!cita) {
        return res.status(400).json({
          mensaje: "La cita indicada no existe"
        });
      }

      if (String(cita.pacienteId) !== String(datos.pacienteId)) {
        return res.status(400).json({
          mensaje: "La cita no corresponde a este paciente"
        });
      }
    }

    // medicoId lo fija el servidor; creado_por sale del JWT.
    const entrada = await historialService.crearEntrada(
      { ...datos, medicoId: emisor.medicoId },
      req.usuario?.id ?? null
    );

    return res.status(201).json({
      mensaje: "Entrada agregada al historial médico",
      entrada
    });
  } catch (error) {
    return manejarErrorBD(error, res, next);
  }
};

module.exports = {
  obtenerHistorial,
  obtenerHistorialDePaciente,
  obtenerMiHistorial,
  obtenerEntrada,
  crearEntrada
};
