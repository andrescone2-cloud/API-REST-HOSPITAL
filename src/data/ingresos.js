// fechaAlta: null = hospitalización en curso.
// La habitación de un ingreso en curso debe estar "ocupada".
const ingresos = [
  {
    id: 1,
    pacienteId: 1,
    habitacionId: 2,
    fechaIngreso:
      "2026-11-12T08:30:00.000Z",
    fechaAlta: null,
    diagnostico:
      "Neumonía aguda"
  },

  {
    id: 2,
    pacienteId: 2,
    habitacionId: 1,
    fechaIngreso:
      "2026-11-01T14:00:00.000Z",
    fechaAlta:
      "2026-11-05T10:00:00.000Z",
    diagnostico:
      "Fractura de tibia"
  }
];

module.exports =
  ingresos;
