// ========================================
// Utilidades compartidas por historial
// medico y recetas
// ========================================

const medicosService = require("../services/medicos.service");
const pacientesService = require("../services/pacientes.service");

// ----------------------------------------
// ¿Quien firma el registro clinico?
//
// - medico: es SIEMPRE el medico asociado a
//   su usuario; no puede actuar a nombre de
//   otro.
// - administrador: debe indicar medicoId.
//
// En ambos casos el medico debe existir y
// estar activo.
//
// Devuelve { ok: true, medicoId } o
// { ok: false, status, mensaje }.
// ----------------------------------------

const resolverMedicoEmisor = async (req, medicoIdSolicitado) => {
  let medico;

  if (req.usuario.rol === "medico") {
    medico = await medicosService.obtenerMedicoPorUsuarioId(req.usuario.id);

    if (!medico) {
      return {
        ok: false,
        status: 403,
        mensaje: "Su usuario no está asociado a un médico"
      };
    }

    if (
      medicoIdSolicitado != null &&
      String(medicoIdSolicitado) !== String(medico.id)
    ) {
      return {
        ok: false,
        status: 403,
        mensaje: "No puede registrar a nombre de otro médico"
      };
    }
  } else {
    if (medicoIdSolicitado == null) {
      return {
        ok: false,
        status: 400,
        mensaje: "El medicoId es obligatorio"
      };
    }

    medico = await medicosService.obtenerMedicoPorId(medicoIdSolicitado);

    if (!medico) {
      return {
        ok: false,
        status: 400,
        mensaje: "El médico indicado no existe"
      };
    }
  }

  if (medico.estado !== "activo") {
    return {
      ok: false,
      status: 409,
      mensaje: `El médico no está activo (estado: ${medico.estado})`
    };
  }

  return { ok: true, medicoId: medico.id };
};

// ----------------------------------------
// ¿Puede esta persona ver los datos de este
// paciente?
//
// administrador y medico: si.
// paciente: solo los suyos (su usuario debe
// estar vinculado a ese paciente).
// ----------------------------------------

const puedeVerPaciente = async (req, pacienteId) => {
  if (req.usuario.rol === "administrador" || req.usuario.rol === "medico") {
    return true;
  }

  if (req.usuario.rol !== "paciente") {
    return false;
  }

  const propio = await pacientesService.obtenerPacientePorUsuarioId(
    req.usuario.id
  );

  return Boolean(propio) && String(propio.id) === String(pacienteId);
};

module.exports = {
  resolverMedicoEmisor,
  puedeVerPaciente
};
