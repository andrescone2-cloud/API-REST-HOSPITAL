const { body, param, query } = require("express-validator");

// ========================================
// Utilidades
// ========================================

const MAX_BIGINT = 9223372036854775807n;

const esIdValido = (valor) => {
  if (typeof valor !== "string" && typeof valor !== "number") {
    return false;
  }

  const texto = String(valor);

  if (!/^[1-9][0-9]*$/.test(texto)) {
    return false;
  }

  if (typeof valor === "number" && !Number.isSafeInteger(valor)) {
    return false;
  }

  try {
    return BigInt(texto) <= MAX_BIGINT;
  } catch {
    return false;
  }
};

// Tolera 1 minuto de desfase de reloj.
const noEsFutura = (valor) => {
  if (new Date(valor).getTime() > Date.now() + 60 * 1000) {
    throw new Error("La fecha no puede ser futura");
  }

  return true;
};

// ========================================
// Parametros
// ========================================

const validarIdEntrada = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero positivo")
];

const validarIdPacienteHistorial = [
  param("pacienteId")
    .isInt({ min: 1 })
    .withMessage("El pacienteId debe ser un número entero positivo")
];

const validarFiltroHistorial = [
  query("pacienteId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("El pacienteId debe ser un número entero positivo")
];

// ========================================
// POST /api/historial
//
// Allowlist: solo estos campos llegan al
// controlador (matchedData). creadoPor y
// creadoEn los pone el servidor.
// ========================================

const validarEntradaHistorial = [
  body("pacienteId")
    .custom(esIdValido)
    .withMessage("El pacienteId debe ser un entero positivo válido"),

  body("medicoId")
    .optional()
    .custom(esIdValido)
    .withMessage("El medicoId debe ser un entero positivo válido"),

  body("citaId")
    .optional()
    .custom(esIdValido)
    .withMessage("El citaId debe ser un entero positivo válido"),

  body("fecha")
    .optional()
    .isISO8601({ strict: true })
    .withMessage(
      "La fecha debe tener formato ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ)"
    )
    .bail()
    .custom(noEsFutura),

  body("motivoConsulta")
    .isString()
    .withMessage("El motivo de consulta debe ser texto")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("El motivo de consulta es obligatorio")
    .isLength({ min: 3, max: 300 })
    .withMessage("El motivo de consulta debe tener entre 3 y 300 caracteres"),

  body("diagnostico")
    .isString()
    .withMessage("El diagnóstico debe ser texto")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("El diagnóstico es obligatorio")
    .isLength({ min: 3, max: 500 })
    .withMessage("El diagnóstico debe tener entre 3 y 500 caracteres"),

  body("tratamiento")
    .optional({ values: "null" })
    .isString()
    .withMessage("El tratamiento debe ser texto")
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("El tratamiento no puede superar 1000 caracteres"),

  body("observaciones")
    .optional({ values: "null" })
    .isString()
    .withMessage("Las observaciones deben ser texto")
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Las observaciones no pueden superar 1000 caracteres")
];

module.exports = {
  validarIdEntrada,
  validarIdPacienteHistorial,
  validarFiltroHistorial,
  validarEntradaHistorial
};
