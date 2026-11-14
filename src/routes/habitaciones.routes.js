// ========================================
// Importaciones
// ========================================

const express = require("express");

const router = express.Router();

const habitacionesController = require("../controllers/habitaciones.controller");

const autenticarJWT = require("../middlewares/auth.middleware");

const autorizarRoles = require("../middlewares/roles.middleware");

const {
  validarIdHabitacion,
  validarHabitacion,
  validarHabitacionCompleta
} = require("../middlewares/habitaciones.validator");

const validar = require("../middlewares/validar.middleware");


// ========================================
// Swagger - Schemas
// ========================================

/**
 * @openapi
 * components:
 *   schemas:
 *
 *     Habitacion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         numero:
 *           type: string
 *           example: "301"
 *         piso:
 *           type: integer
 *           example: 3
 *         tipo:
 *           type: string
 *           enum: [UCI, General, Aislamiento]
 *           example: General
 *         estado:
 *           type: string
 *           enum: [disponible, ocupada, mantenimiento]
 *           example: disponible
 *
 *     HabitacionEntrada:
 *       type: object
 *       required: [numero, piso, tipo]
 *       properties:
 *         numero:
 *           type: string
 *           pattern: '^[A-Za-z0-9-]{1,10}$'
 *           example: "301"
 *         piso:
 *           type: integer
 *           minimum: -5
 *           maximum: 100
 *           example: 3
 *         tipo:
 *           type: string
 *           enum: [UCI, General, Aislamiento]
 *         estado:
 *           type: string
 *           enum: [disponible, mantenimiento]
 *           description: >
 *             Opcional al crear (por defecto disponible). "ocupada" la
 *             asigna el sistema al registrar un ingreso.
 */


// ========================================
// GET /api/habitaciones
// Administrador y médico
// ========================================

/**
 * @openapi
 * /api/habitaciones:
 *   get:
 *     tags: [Habitaciones]
 *     summary: Listar habitaciones
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de habitaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Habitacion'
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permisos
 */
router.get(
  "/",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  habitacionesController.obtenerHabitaciones
);


// ========================================
// GET /api/habitaciones/disponibles
//
// Debe declararse ANTES de "/:id"; si no,
// Express interpretaria "disponibles" como
// un id.
// ========================================

/**
 * @openapi
 * /api/habitaciones/disponibles:
 *   get:
 *     tags: [Habitaciones]
 *     summary: Listar habitaciones disponibles
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Habitaciones con estado disponible
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Habitacion'
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permisos
 */
router.get(
  "/disponibles",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  habitacionesController.obtenerHabitacionesDisponibles
);


// ========================================
// GET /api/habitaciones/:id
// Administrador y médico
// ========================================

/**
 * @openapi
 * /api/habitaciones/{id}:
 *   get:
 *     tags: [Habitaciones]
 *     summary: Obtener una habitación por ID
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
 *         description: Habitación encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Habitacion'
 *       400:
 *         description: ID inválido
 *       404:
 *         description: Habitación no encontrada
 */
router.get(
  "/:id",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarIdHabitacion,

  validar,

  habitacionesController.obtenerHabitacionPorId
);


// ========================================
// POST /api/habitaciones
// Solo administrador
// ========================================

/**
 * @openapi
 * /api/habitaciones:
 *   post:
 *     tags: [Habitaciones]
 *     summary: Crear una habitación
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HabitacionEntrada'
 *     responses:
 *       201:
 *         description: Habitación creada
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Número de habitación duplicado
 */
router.post(
  "/",

  autenticarJWT,

  autorizarRoles("administrador"),

  validarHabitacion,

  validar,

  habitacionesController.crearHabitacion
);


// ========================================
// PUT /api/habitaciones/:id
// Solo administrador
// ========================================

/**
 * @openapi
 * /api/habitaciones/{id}:
 *   put:
 *     tags: [Habitaciones]
 *     summary: Actualizar una habitación
 *     description: >
 *       Reemplaza numero, piso, tipo y estado. Una habitación con
 *       ingreso activo debe permanecer "ocupada", y "ocupada" no se
 *       puede fijar manualmente.
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/HabitacionEntrada'
 *               - type: object
 *                 required: [estado]
 *     responses:
 *       200:
 *         description: Habitación actualizada
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Habitación no encontrada
 *       409:
 *         description: Número duplicado o estado incompatible con un ingreso
 */
router.put(
  "/:id",

  autenticarJWT,

  autorizarRoles("administrador"),

  validarIdHabitacion,

  validarHabitacionCompleta,

  validar,

  habitacionesController.actualizarHabitacion
);


// ========================================
// Exportar router
// ========================================

module.exports = router;
