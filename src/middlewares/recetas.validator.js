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

const ESTADOS = ["activa", "dispensada", "anulada"];

// ========================================
// Parametros y filtros
// ========================================

const validarIdReceta = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero positivo")
];

const validarIdPacienteReceta = [
  param("pacienteId")
    .isInt({ min: 1 })
    .withMessage("El pacienteId debe ser un número entero positivo")
];

const validarFiltroRecetas = [
  query("pacienteId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("El pacienteId debe ser un número entero positivo"),

  query("estado")
    .optional()
    .isIn(ESTADOS)
    .withMessage("El estado debe ser activa, dispensada o anulada")
];

// ========================================
// POST /api/recetas
//
// Allowlist con matchedData(): solo estos
// campos (y solo estos campos de cada
// medicamento) llegan al controlador.
// ========================================

const validarReceta = [
  body("pacienteId")
    .custom(esIdValido)
    .withMessage("El pacienteId debe ser un entero positivo válido"),

  body("medicoId")
    .optional()
    .custom(esIdValido)
    .withMessage("El medicoId debe ser un entero positivo válido"),

  body("historialId")
    .optional()
    .custom(esIdValido)
    .withMessage("El historialId debe ser un entero positivo válido"),

  body("indicaciones")
    .optional({ values: "null" })
    .isString()
    .withMessage("Las indicaciones deben ser texto")
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Las indicaciones no pueden superar 500 caracteres"),

  body("medicamentos")
    .isArray({ min: 1, max: 20 })
    .withMessage("La receta debe incluir entre 1 y 20 medicamentos"),

  body("medicamentos.*.medicamento")
    .isString()
    .withMessage("El nombre del medicamento debe ser texto")
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El medicamento debe tener entre 2 y 100 caracteres"),

  body("medicamentos.*.dosis")
    .isString()
    .withMessage("La dosis debe ser texto")
    .bail()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("La dosis debe tener entre 1 y 50 caracteres"),

  body("medicamentos.*.frecuencia")
    .isString()
    .withMessage("La frecuencia debe ser texto")
    .bail()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("La frecuencia debe tener entre 1 y 50 caracteres"),

  body("medicamentos.*.duracionDias")
    .isInt({ min: 1, max: 365 })
    .withMessage("La duración debe ser un entero entre 1 y 365 días")
    .toInt(),

  body("medicamentos.*.instrucciones")
    .optional({ values: "null" })
    .isString()
    .withMessage("Las instrucciones deben ser texto")
    .bail()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Las instrucciones no pueden superar 300 caracteres")
];

// ========================================
// PATCH /api/recetas/:id/estado
// ========================================

const validarEstadoReceta = [
  body("estado")
    .isIn(["dispensada", "anulada"])
    .withMessage("El estado debe ser dispensada o anulada")
];

module.exports = {
  validarIdReceta,
  validarIdPacienteReceta,
  validarFiltroRecetas,
  validarReceta,
  validarEstadoReceta
};
