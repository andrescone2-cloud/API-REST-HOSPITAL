const express = require("express");

const router = express.Router();

/**
 * @openapi
 * /api/seguridad/cliente:
 *   get:
 *
 *     tags:
 *       - Seguridad
 *
 *     summary:
 *       Obtener información del cliente autenticado
 *
 *     description:
 *       Retorna la identidad asociada a la API Key utilizada.
 *
 *     security:
 *       - ApiKeyAuth: []
 *
 *     responses:
 *
 *       200:
 *         description:
 *           Cliente autenticado correctamente
 *
 *         content:
 *           application/json:
 *
 *             schema:
 *               type: object
 *
 *               properties:
 *
 *                 mensaje:
 *                   type: string
 *                   example: Cliente autenticado
 *
 *                 cliente:
 *                   type: object
 *
 *                   properties:
 *
 *                     id:
 *                       type: integer
 *                       example: 1
 *
 *                     nombre:
 *                       type: string
 *                       example: Postman Laboratorio
 *
 *       401:
 *         description:
 *           API Key ausente o inválida
 *
 *       403:
 *         description:
 *           API Key deshabilitada
 */
router.get(
  "/cliente",

  (
    req,
    res
  ) => {

    return res
      .status(200)
      .json({

        mensaje:
          "Cliente autenticado",

        cliente:
          req.clienteApi
      });
  }
);

module.exports = router;
