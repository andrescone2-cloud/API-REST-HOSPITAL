// Recetas con sus medicamentos (referencia del seed).
// estado: activa | dispensada | anulada
const recetas = [
  {
    id: 1,
    pacienteId: 2,
    medicoId: 1,
    historialId: 2,
    fecha:
      "2026-11-11T09:45:00.000Z",
    indicaciones:
      "Reposo y abundante líquido",
    estado: "activa",
    creadoPor: 1,
    medicamentos: [
      {
        medicamento: "Amoxicilina",
        dosis: "500 mg",
        frecuencia: "Cada 8 horas",
        duracionDias: 7,
        instrucciones:
          "Tomar con alimentos"
      },

      {
        medicamento: "Paracetamol",
        dosis: "1 g",
        frecuencia: "Cada 12 horas",
        duracionDias: 3,
        instrucciones: null
      }
    ]
  }
];

module.exports =
  recetas;
