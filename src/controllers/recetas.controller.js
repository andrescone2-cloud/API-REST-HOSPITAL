const { matchedData } = require("express-validator");

const recetasService = require("../services/recetas.service");
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
      mensaje: "Los datos de la receta no son válidos"
    });
  }

  return next(error);
};

// ========================================
// Advertencias de alergias
//
// Compara las alergias registradas del
// paciente con los medicamentos de la
// receta. NO bloquea: avisa, y el medico
// decide.
// ========================================

const normalizar = (texto) =>
  String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const detectarAlergias = (alergias, medicamentos) => {
  if (!alergias) {
    return [];
  }

  const alergenos = String(alergias)
    .split(/[,;\n]|\sy\s/i)
    .map(normalizar)
    .filter((a) => a.length >= 4);

  const avisos = [];

  for (const m of medicamentos) {
    const nombre = normalizar(m.medicamento);

    for (const alergeno of alergenos) {
      if (nombre.includes(alergeno) || alergeno.includes(nombre)) {
        avisos.push(
          `El paciente registra alergia a "${alergeno}" y la receta incluye "${m.medicamento}"`
        );
      }
    }
  }

  return avisos;
};

// ========================================
// GET /api/recetas[?pacienteId=&estado=]
// Administrador y médico
// ========================================

const obtenerRecetas = async (req, res, next) => {
  try {
    const recetas = await recetasService.obtenerRecetas({
      pacienteId: req.query.pacienteId ?? null,
      estado: req.query.estado ?? null
    });

    return res.status(200).json(recetas);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET /api/recetas/paciente/:pacienteId
// Administrador, médico y el propio paciente
// ========================================

const obtenerRecetasDePaciente = async (req, res, next) => {
  try {
    const { pacienteId } = req.params;

    if (!(await puedeVerPaciente(req, pacienteId))) {
      return res.status(403).json({
        mensaje: "No tiene permisos para ver las recetas de este paciente"
      });
    }

    const paciente = await pacientesService.obtenerPacientePorId(pacienteId);

    if (!paciente) {
      return res.status(404).json({
        mensaje: "Paciente no encontrado"
      });
    }

    const recetas = await recetasService.obtenerRecetas({ pacienteId });

    return res.status(200).json(recetas);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET /api/recetas/mis-recetas
// Solo paciente: sus propias recetas
// ========================================

const obtenerMisRecetas = async (req, res, next) => {
  try {
    const paciente = await pacientesService.obtenerPacientePorUsuarioId(
      req.usuario.id
    );

    if (!paciente) {
      return res.status(404).json({
        mensaje: "Su usuario no está asociado a un paciente"
      });
    }

    const recetas = await recetasService.obtenerRecetas({
      pacienteId: paciente.id
    });

    return res.status(200).json(recetas);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET /api/recetas/:id
// ========================================

const obtenerReceta = async (req, res, next) => {
  try {
    const receta = await recetasService.obtenerRecetaPorId(req.params.id);

    if (!receta || !(await puedeVerPaciente(req, receta.pacienteId))) {
      return res.status(404).json({
        mensaje: "Receta no encontrada"
      });
    }

    return res.status(200).json(receta);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// POST /api/recetas
// Administrador y médico
// ========================================

const crearReceta = async (req, res, next) => {
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

    if (datos.historialId != null) {
      const entrada = await historialService.obtenerEntradaPorId(
        datos.historialId
      );

      if (!entrada) {
        return res.status(400).json({
          mensaje: "La entrada de historial indicada no existe"
        });
      }

      if (String(entrada.pacienteId) !== String(datos.pacienteId)) {
        return res.status(400).json({
          mensaje: "La entrada de historial no corresponde a este paciente"
        });
      }
    }

    const receta = await recetasService.crearReceta(
      { ...datos, medicoId: emisor.medicoId },
      req.usuario?.id ?? null
    );

    return res.status(201).json({
      mensaje: "Receta emitida correctamente",
      receta,
      advertencias: detectarAlergias(paciente.alergias, datos.medicamentos)
    });
  } catch (error) {
    return manejarErrorBD(error, res, next);
  }
};

// ========================================
// PATCH /api/recetas/:id/estado
// Administrador y médico
// ========================================

const cambiarEstado = async (req, res, next) => {
  try {
    const { estado } = matchedData(req, { locations: ["body"] });

    const resultado = await recetasService.cambiarEstado(
      req.params.id,
      estado
    );

    if (!resultado.ok) {
      return res.status(resultado.status).json({
        mensaje: resultado.mensaje
      });
    }

    return res.status(200).json({
      mensaje: "Estado de la receta actualizado",
      receta: resultado.receta
    });
  } catch (error) {
    return manejarErrorBD(error, res, next);
  }
};

module.exports = {
  obtenerRecetas,
  obtenerRecetasDePaciente,
  obtenerMisRecetas,
  obtenerReceta,
  crearReceta,
  cambiarEstado
};
