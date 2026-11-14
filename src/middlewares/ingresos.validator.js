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

// Tolera 1 minuto de desfase de reloj entre cliente y servidor.
const noEsFutura = (valor) => {
  if (new Date(valor).getTime() > Date.now() + 60 * 1000) {
    throw new Error("La fecha no puede ser futura");
  }

  return true;
};

// ========================================
// ID de ingreso
// ========================================

const validarIdIngreso = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero positivo")
];

// ========================================
// Filtro de listado
// ========================================

const validarFiltroIngresos = [
  query("activo")
    .optional()
    .isBoolean()
    .withMessage("El filtro activo debe ser true o false")
];

// ========================================
// POST /api/ingresos
// ========================================

const validarIngreso = [
  body("pacienteId")
    .custom(esIdValido)
    .withMessage("El pacienteId debe ser un entero positivo válido"),

  body("habitacionId")
    .custom(esIdValido)
    .withMessage("La habitacionId debe ser un entero positivo válido"),

  body("fechaIngreso")
    .optional()
    .isISO8601({ strict: true })
    .withMessage(
      "La fecha de ingreso debe tener formato ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ)"
    )
    .bail()
    .custom(noEsFutura),

  body("diagnostico")
    .isString()
    .withMessage("El diagnóstico debe ser texto")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("El diagnóstico es obligatorio")
    .isLength({ min: 3, max: 500 })
    .withMessage("El diagnóstico debe tener entre 3 y 500 caracteres")
];

// ========================================
// PATCH /api/ingresos/:id/dar-alta
// ========================================

const validarAlta = [
  body("fechaAlta")
    .optional()
    .isISO8601({ strict: true })
    .withMessage(
      "La fecha de alta debe tener formato ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ)"
    )
    .bail()
    .custom(noEsFutura)
];

module.exports = {
  validarIdIngreso,
  validarFiltroIngresos,
  validarIngreso,
  validarAlta
};
