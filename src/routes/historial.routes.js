// ========================================
// Importaciones
// ========================================

const express = require("express");

const router = express.Router();

const historialController = require("../controllers/historial.controller");

const autenticarJWT = require("../middlewares/auth.middleware");

const autorizarRoles = require("../middlewares/roles.middleware");

const {
  validarIdEntrada,
  validarIdPacienteHistorial,
  validarFiltroHistorial,
  validarEntradaHistorial
} = require("../middlewares/historial.validator");

const validar = require("../middlewares/validar.middleware");


// ========================================
// Swagger - Schemas
// ========================================

/**
 * @openapi
 * components:
 *   schemas:
 *
 *     EntradaHistorial:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         pacienteId:
 *           type: integer
 *           example: 1
 *         medicoId:
 *           type: integer
 *           example: 2
 *         citaId:
 *           type: integer
 *           nullable: true
 *           example: 5
 *         fecha:
 *           type: string
 *           format: date-time
 *         motivoConsulta:
 *           type: string
 *           example: Dolor torácico
 *         diagnostico:
 *           type: string
 *           example: Angina estable
 *         tratamiento:
 *           type: string
 *           nullable: true
 *           example: Reposo y control en 15 días
 *         observaciones:
 *           type: string
 *           nullable: true
 *         creadoPor:
 *           type: integer
 *           nullable: true
 *           description: Id del usuario (JWT) que registró la entrada
 *         creadoEn:
 *           type: string
 *           format: date-time
 *
 *     EntradaHistorialEntrada:
 *       type: object
 *       required: [pacienteId, motivoConsulta, diagnostico]
 *       properties:
 *         pacienteId:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         medicoId:
 *           type: integer
 *           minimum: 1
 *           description: >
 *             Obligatorio para el administrador. Un médico siempre firma
 *             con su propio registro (no puede actuar a nombre de otro).
 *         citaId:
 *           type: integer
 *           minimum: 1
 *           description: Opcional; debe ser una cita del mismo paciente.
 *         fecha:
 *           type: string
 *           format: date-time
 *           description: Opcional; por defecto, ahora. No puede ser futura.
 *         motivoConsulta:
 *           type: string
 *           minLength: 3
 *           maxLength: 300
 *           example: Dolor torácico
 *         diagnostico:
 *           type: string
 *           minLength: 3
 *           maxLength: 500
 *           example: Angina estable
 *         tratamiento:
 *           type: string
 *           maxLength: 1000
 *         observaciones:
 *           type: string
 *           maxLength: 1000
 */


// ========================================
// GET /api/historial
// ========================================

/**
 * @openapi
 * /api/historial:
 *   get:
 *     tags: [Historial médico]
 *     summary: Listar el historial médico
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pacienteId
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Entradas de historial (más recientes primero)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EntradaHistorial'
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permisos (solo administrador y médico)
 */
router.get(
  "/",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarFiltroHistorial,

  validar,

  historialController.obtenerHistorial
);


// ========================================
// GET /api/historial/mi-historial
// (antes de "/:id")
// ========================================

/**
 * @openapi
 * /api/historial/mi-historial:
 *   get:
 *     tags: [Historial médico]
 *     summary: Mi historial médico (solo rol paciente)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Historial del paciente autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EntradaHistorial'
 *       403:
 *         description: Solo para el rol paciente
 *       404:
 *         description: El usuario no está asociado a un paciente
 */
router.get(
  "/mi-historial",

  autenticarJWT,

  autorizarRoles("paciente"),

  historialController.obtenerMiHistorial
);


// ========================================
// GET /api/historial/paciente/:pacienteId
//
// Antes de "/:id", para que "paciente" no
// se tome como un id.
// ========================================

/**
 * @openapi
 * /api/historial/paciente/{pacienteId}:
 *   get:
 *     tags: [Historial médico]
 *     summary: Historial médico de un paciente
 *     description: >
 *       Administrador y médico ven el de cualquier paciente. Un paciente
 *       solo puede ver el suyo (403 si pide el de otro).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pacienteId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Historial del paciente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EntradaHistorial'
 *       403:
 *         description: Un paciente intentó ver el historial de otro
 *       404:
 *         description: Paciente no encontrado
 */
router.get(
  "/paciente/:pacienteId",

  autenticarJWT,

  autorizarRoles("administrador", "medico", "paciente"),

  validarIdPacienteHistorial,

  validar,

  historialController.obtenerHistorialDePaciente
);


// ========================================
// GET /api/historial/:id
// ========================================

/**
 * @openapi
 * /api/historial/{id}:
 *   get:
 *     tags: [Historial médico]
 *     summary: Obtener una entrada del historial
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
 *         description: Entrada encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EntradaHistorial'
 *       404:
 *         description: No existe (o es de otro paciente, para el rol paciente)
 */
router.get(
  "/:id",

  autenticarJWT,

  autorizarRoles("administrador", "medico", "paciente"),

  validarIdEntrada,

  validar,

  historialController.obtenerEntrada
);


// ========================================
// POST /api/historial
// ========================================

/**
 * @openapi
 * /api/historial:
 *   post:
 *     tags: [Historial médico]
 *     summary: Agregar una entrada al historial médico
 *     description: >
 *       El historial solo se agrega: no se edita ni se borra desde la API.
 *       El médico firmante debe estar activo. `creadoPor` sale del JWT.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EntradaHistorialEntrada'
 *     responses:
 *       201:
 *         description: Entrada agregada
 *       400:
 *         description: Datos inválidos, paciente, médico o cita inexistente
 *       403:
 *         description: Rol sin permiso, o médico actuando a nombre de otro
 *       409:
 *         description: El médico no está activo
 */
router.post(
  "/",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarEntradaHistorial,

  validar,

  historialController.crearEntrada
);


// ========================================
// Exportar router
// ========================================

module.exports = router;
