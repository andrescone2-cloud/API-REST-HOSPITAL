// ========================================
// Alias de campos de entrada
//
// La especificacion del proyecto nombra
// algunos campos distinto de como ya los
// usa la API (y la SPA):
//
//   correo         -> email
//   licenciaMedica -> registroMedico
//   atendida       -> completada (cita)
//
// Este middleware traduce el nombre nuevo
// al existente ANTES de validar, de modo
// que ambos nombres funcionan y los
// validadores y servicios no cambian.
//
// Si llegan los dos, manda el nombre
// original.
// ========================================

const aplicarAlias = (alias) => (req, res, next) => {
  const cuerpo = req.body;

  if (cuerpo && typeof cuerpo === "object" && !Array.isArray(cuerpo)) {
    for (const [nuevo, original] of Object.entries(alias)) {
      if (Object.hasOwn(cuerpo, nuevo)) {
        if (!Object.hasOwn(cuerpo, original)) {
          cuerpo[original] = cuerpo[nuevo];
        }
        delete cuerpo[nuevo];
      }
    }
  }

  next();
};

const aliasPaciente = aplicarAlias({ correo: "email" });

const aliasMedico = aplicarAlias({
  correo: "email",
  licenciaMedica: "registroMedico"
});

module.exports = {
  aliasPaciente,
  aliasMedico
};
