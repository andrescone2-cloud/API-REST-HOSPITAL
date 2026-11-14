// ========================================
// Importaciones
// ========================================

const express = require("express");

const router = express.Router();

const ingresosController = require("../controllers/ingresos.controller");

const autenticarJWT = require("../middlewares/auth.middleware");

const autorizarRoles = require("../middlewares/roles.middleware");

const {
  validarIdIngreso,
  validarFiltroIngresos,
  validarIngreso,
  validarAlta
} = require("../middlewares/ingresos.validator");

const validar = require("../middlewares/validar.middleware");


// ========================================
// Swagger - Schemas
// ========================================

/**
 * @openapi
 * components:
 *   schemas:
 *
 *     Ingreso:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         pacienteId:
 *           type: integer
 *           example: 1
 *         habitacionId:
 *           type: integer
 *           example: 2
 *         fechaIngreso:
 *           type: string
 *           format: date-time
 *           example: "2026-11-13T14:30:00.000Z"
 *         fechaAlta:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         diagnostico:
 *           type: string
 *           example: Neumonía aguda
 *         registradoPor:
 *           type: integer
 *           nullable: true
 *           description: Id del usuario (JWT) que registró el ingreso
 *           example: 1
 *         altaPor:
 *           type: integer
 *           nullable: true
 *           description: Id del usuario (JWT) que dio el alta
 *           example: null
 *         creadoEn:
 *           type: string
 *           format: date-time
 *           description: Momento en que se creó el registro
 *
 *     IngresoEntrada:
 *       type: object
 *       required: [pacienteId, habitacionId, diagnostico]
 *       properties:
 *         pacienteId:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         habitacionId:
 *           type: integer
 *           minimum: 1
 *           example: 2
 *         fechaIngreso:
 *           type: string
 *           format: date-time
 *           description: Opcional; por defecto, el momento actual. No puede ser futura.
 *         diagnostico:
 *           type: string
 *           minLength: 3
 *           maxLength: 500
 *           example: Neumonía aguda
 *
 *     AltaEntrada:
 *       type: object
 *       properties:
 *         fechaAlta:
 *           type: string
 *           format: date-time
 *           description: >
 *             Opcional; por defecto, el momento actual. No puede ser
 *             anterior a la fecha de ingreso ni futura.
 */


// ========================================
// GET /api/ingresos
// Administrador y médico
// ========================================

/**
 * @openapi
 * /api/ingresos:
 *   get:
 *     tags: [Ingresos]
 *     summary: Listar ingresos / hospitalizaciones
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activo
 *         required: false
 *         description: true = sin alta; false = con alta
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Lista de ingresos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ingreso'
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permisos
 */
router.get(
  "/",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarFiltroIngresos,

  validar,

  ingresosController.obtenerIngresos
);


// ========================================
// GET /api/ingresos/:id
// Administrador y médico
// ========================================

/**
 * @openapi
 * /api/ingresos/{id}:
 *   get:
 *     tags: [Ingresos]
 *     summary: Obtener un ingreso por ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Ingreso encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ingreso'
 *       404:
 *         description: Ingreso no encontrado
 */
router.get(
  "/:id",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarIdIngreso,

  validar,

  ingresosController.obtenerIngresoPorId
);


// ========================================
// POST /api/ingresos
// Administrador y médico
// ========================================

/**
 * @openapi
 * /api/ingresos:
 *   post:
 *     tags: [Ingresos]
 *     summary: Registrar un ingreso
 *     description: >
 *       Requiere un paciente existente y una habitación disponible.
 *       La habitación pasa a "ocupada" en la misma transacción.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IngresoEntrada'
 *     responses:
 *       201:
 *         description: Ingreso registrado
 *       400:
 *         description: Datos inválidos, paciente o habitación inexistente
 *       409:
 *         description: Habitación ocupada o en mantenimiento, o paciente ya hospitalizado
 */
router.post(
  "/",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarIngreso,

  validar,

  ingresosController.crearIngreso
);


// ========================================
// PATCH /api/ingresos/:id/dar-alta
// Administrador y médico
// ========================================

/**
 * @openapi
 * /api/ingresos/{id}/dar-alta:
 *   patch:
 *     tags: [Ingresos]
 *     summary: Dar de alta a un paciente
 *     description: >
 *       Registra la fecha de alta y devuelve la habitación al estado
 *       "disponible" en la misma transacción.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AltaEntrada'
 *     responses:
 *       200:
 *         description: Alta registrada
 *       400:
 *         description: Fecha inválida o anterior a la fecha de ingreso
 *       404:
 *         description: Ingreso no encontrado
 *       409:
 *         description: El ingreso ya tiene alta
 */
router.patch(
  "/:id/dar-alta",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarIdIngreso,

  validarAlta,

  validar,

  ingresosController.darAlta
);


// ========================================
// Exportar router
// ========================================

module.exports = router;
