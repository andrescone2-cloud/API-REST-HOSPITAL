// ========================================
// Importaciones
// ========================================

const express = require("express");

const router = express.Router();

const recetasController = require("../controllers/recetas.controller");

const autenticarJWT = require("../middlewares/auth.middleware");

const autorizarRoles = require("../middlewares/roles.middleware");

const {
  validarIdReceta,
  validarIdPacienteReceta,
  validarFiltroRecetas,
  validarReceta,
  validarEstadoReceta
} = require("../middlewares/recetas.validator");

const validar = require("../middlewares/validar.middleware");


// ========================================
// Swagger - Schemas
// ========================================

/**
 * @openapi
 * components:
 *   schemas:
 *
 *     MedicamentoReceta:
 *       type: object
 *       required: [medicamento, dosis, frecuencia, duracionDias]
 *       properties:
 *         medicamento:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           example: Amoxicilina
 *         dosis:
 *           type: string
 *           maxLength: 50
 *           example: 500 mg
 *         frecuencia:
 *           type: string
 *           maxLength: 50
 *           example: Cada 8 horas
 *         duracionDias:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           example: 7
 *         instrucciones:
 *           type: string
 *           maxLength: 300
 *           example: Tomar con alimentos
 *
 *     Receta:
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
 *         historialId:
 *           type: integer
 *           nullable: true
 *         fecha:
 *           type: string
 *           format: date-time
 *         indicaciones:
 *           type: string
 *           nullable: true
 *         estado:
 *           type: string
 *           enum: [activa, dispensada, anulada]
 *         creadoPor:
 *           type: integer
 *           nullable: true
 *         creadoEn:
 *           type: string
 *           format: date-time
 *         medicamentos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MedicamentoReceta'
 *
 *     RecetaEntrada:
 *       type: object
 *       required: [pacienteId, medicamentos]
 *       properties:
 *         pacienteId:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         medicoId:
 *           type: integer
 *           minimum: 1
 *           description: >
 *             Obligatorio para el administrador. Un médico siempre emite
 *             con su propio registro.
 *         historialId:
 *           type: integer
 *           minimum: 1
 *           description: Opcional; debe ser una entrada del mismo paciente.
 *         indicaciones:
 *           type: string
 *           maxLength: 500
 *           example: Beber abundante agua
 *         medicamentos:
 *           type: array
 *           minItems: 1
 *           maxItems: 20
 *           items:
 *             $ref: '#/components/schemas/MedicamentoReceta'
 *
 *     RecetaEstadoEntrada:
 *       type: object
 *       required: [estado]
 *       properties:
 *         estado:
 *           type: string
 *           enum: [dispensada, anulada]
 */


// ========================================
// GET /api/recetas
// ========================================

/**
 * @openapi
 * /api/recetas:
 *   get:
 *     tags: [Recetas]
 *     summary: Listar recetas
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pacienteId
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: estado
 *         required: false
 *         schema:
 *           type: string
 *           enum: [activa, dispensada, anulada]
 *     responses:
 *       200:
 *         description: Recetas con sus medicamentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Receta'
 *       403:
 *         description: Sin permisos (solo administrador y médico)
 */
router.get(
  "/",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarFiltroRecetas,

  validar,

  recetasController.obtenerRecetas
);


// ========================================
// GET /api/recetas/mis-recetas
// (antes de "/:id")
// ========================================

/**
 * @openapi
 * /api/recetas/mis-recetas:
 *   get:
 *     tags: [Recetas]
 *     summary: Mis recetas (solo rol paciente)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Recetas del paciente autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Receta'
 *       403:
 *         description: Solo para el rol paciente
 *       404:
 *         description: El usuario no está asociado a un paciente
 */
router.get(
  "/mis-recetas",

  autenticarJWT,

  autorizarRoles("paciente"),

  recetasController.obtenerMisRecetas
);


// ========================================
// GET /api/recetas/paciente/:pacienteId
// (antes de "/:id")
// ========================================

/**
 * @openapi
 * /api/recetas/paciente/{pacienteId}:
 *   get:
 *     tags: [Recetas]
 *     summary: Recetas de un paciente
 *     description: >
 *       Administrador y médico ven las de cualquier paciente. Un paciente
 *       solo puede ver las suyas (403 si pide las de otro).
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
 *         description: Recetas del paciente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Receta'
 *       403:
 *         description: Un paciente intentó ver las recetas de otro
 *       404:
 *         description: Paciente no encontrado
 */
router.get(
  "/paciente/:pacienteId",

  autenticarJWT,

  autorizarRoles("administrador", "medico", "paciente"),

  validarIdPacienteReceta,

  validar,

  recetasController.obtenerRecetasDePaciente
);


// ========================================
// GET /api/recetas/:id
// ========================================

/**
 * @openapi
 * /api/recetas/{id}:
 *   get:
 *     tags: [Recetas]
 *     summary: Obtener una receta con sus medicamentos
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
 *         description: Receta encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Receta'
 *       404:
 *         description: No existe (o es de otro paciente, para el rol paciente)
 */
router.get(
  "/:id",

  autenticarJWT,

  autorizarRoles("administrador", "medico", "paciente"),

  validarIdReceta,

  validar,

  recetasController.obtenerReceta
);


// ========================================
// POST /api/recetas
// ========================================

/**
 * @openapi
 * /api/recetas:
 *   post:
 *     tags: [Recetas]
 *     summary: Emitir una receta médica
 *     description: >
 *       Guarda la receta y todos sus medicamentos en una sola transacción.
 *       El médico emisor debe estar activo. Si las alergias registradas del
 *       paciente coinciden con algún medicamento, la respuesta incluye
 *       `advertencias` (no bloquea la receta).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecetaEntrada'
 *     responses:
 *       201:
 *         description: Receta emitida (con advertencias de alergia, si las hay)
 *       400:
 *         description: Datos inválidos, paciente, médico o historial inexistente
 *       403:
 *         description: Rol sin permiso, o médico actuando a nombre de otro
 *       409:
 *         description: El médico no está activo
 */
router.post(
  "/",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarReceta,

  validar,

  recetasController.crearReceta
);


// ========================================
// PATCH /api/recetas/:id/estado
// ========================================

/**
 * @openapi
 * /api/recetas/{id}/estado:
 *   patch:
 *     tags: [Recetas]
 *     summary: Dispensar o anular una receta
 *     description: >
 *       Solo una receta activa puede pasar a dispensada o anulada; ambos
 *       estados son finales.
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
 *             $ref: '#/components/schemas/RecetaEstadoEntrada'
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       400:
 *         description: Estado inválido
 *       404:
 *         description: Receta no encontrada
 *       409:
 *         description: Transición no permitida
 */
router.patch(
  "/:id/estado",

  autenticarJWT,

  autorizarRoles("administrador", "medico"),

  validarIdReceta,

  validarEstadoReceta,

  validar,

  recetasController.cambiarEstado
);


// ========================================
// Exportar router
// ========================================

module.exports = router;
