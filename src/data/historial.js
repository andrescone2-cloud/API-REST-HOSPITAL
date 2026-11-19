// Entradas de historial médico (referencia del seed).
// El historial solo se agrega: no se edita ni se borra.
const historial = [
  {
    id: 1,
    pacienteId: 1,
    medicoId: 1,
    citaId: null,
    fecha:
      "2026-11-10T15:00:00.000Z",
    motivoConsulta:
      "Dolor torácico",
    diagnostico:
      "Angina estable",
    tratamiento:
      "Reposo y control en 15 días",
    observaciones:
      "Paciente refiere alergia a la penicilina",
    creadoPor: 1
  },

  {
    id: 2,
    pacienteId: 2,
    medicoId: 1,
    citaId: null,
    fecha:
      "2026-11-11T09:30:00.000Z",
    motivoConsulta:
      "Fiebre y tos de tres días",
    diagnostico:
      "Infección respiratoria aguda",
    tratamiento:
      "Antibiótico y reposo",
    observaciones:
      null,
    creadoPor: 1
  }
];

module.exports =
  historial;
