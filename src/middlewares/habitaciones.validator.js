const { body, param } = require("express-validator");

// ========================================
// ID de habitación
// ========================================

const validarIdHabitacion = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El id debe ser un número entero positivo")
];

// ========================================
// Campos comunes (POST y PUT)
//
// Allowlist: solo estos campos llegan al
// controlador a través de matchedData().
// ========================================

const camposHabitacion = [
  body("numero")
    .isString()
    .withMessage("El número debe ser texto")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("El número es obligatorio")
    .matches(/^[A-Za-z0-9-]{1,10}$/)
    .withMessage(
      "El número debe tener entre 1 y 10 caracteres (letras, dígitos o guion)"
    ),

  body("piso")
    .isInt({ min: -5, max: 100 })
    .withMessage("El piso debe ser un entero entre -5 y 100")
    .toInt(),

  body("tipo")
    .isIn(["UCI", "General", "Aislamiento"])
    .withMessage("El tipo debe ser UCI, General o Aislamiento")
];

// POST: el estado es opcional (por defecto "disponible")
const validarHabitacion = [
  ...camposHabitacion,

  body("estado")
    .optional()
    .isIn(["disponible", "ocupada", "mantenimiento"])
    .withMessage(
      "El estado debe ser disponible, ocupada o mantenimiento"
    )
];

// PUT: reemplazo completo, el estado es obligatorio
const validarHabitacionCompleta = [
  ...camposHabitacion,

  body("estado")
    .isIn(["disponible", "ocupada", "mantenimiento"])
    .withMessage(
      "El estado debe ser disponible, ocupada o mantenimiento"
    )
];

module.exports = {
  validarIdHabitacion,
  validarHabitacion,
  validarHabitacionCompleta
};
