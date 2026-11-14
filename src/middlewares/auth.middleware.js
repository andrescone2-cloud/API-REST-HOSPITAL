const {
  verificarToken
} = require(
  "../utils/jwt.util"
);


const usuariosService =
  require(
    "../services/usuarios.service"
  );


// ========================================
// Errores propios de jsonwebtoken
//
// Solo estos tres significan "el token que
// me mandaron no sirve". Cualquier otro es
// un fallo nuestro y debe subir al manejador
// global, no disfrazarse de 401.
// ========================================

const ERRORES_DE_TOKEN = [
  "JsonWebTokenError",
  "TokenExpiredError",
  "NotBeforeError"
];


// ========================================
// Autenticar mediante JWT + PostgreSQL
//
// Desde el Bloque 7 no basta con que la
// firma sea válida: se consulta la identidad
// real en la base de datos.
//
// Un token es una foto del pasado. Entre que
// se emitió y se usa, la cuenta pudo
// borrarse, desactivarse o cambiar de rol.
// ========================================

const autenticarJWT = async (
  req,
  res,
  next
) => {

  const authorization =
    req.get("Authorization");


  // --------------------------------------
  // Cabecera ausente
  // --------------------------------------

  if (!authorization) {

    return res
      .status(401)
      .json({

        mensaje:
          "Token de autenticación requerido"
      });
  }


  // --------------------------------------
  // Validar formato Bearer
  //
  // Se parte por espacios en blanco para
  // tolerar separadores repetidos.
  // --------------------------------------

  const partes =
    authorization
      .trim()
      .split(/\s+/);


  if (
    partes.length !== 2 ||
    partes[0] !== "Bearer" ||
    !partes[1]
  ) {

    return res
      .status(401)
      .json({

        mensaje:
          "Formato de token inválido"
      });
  }


  try {

    // ------------------------------------
    // Verificar firma y expiración
    // ------------------------------------

    const payload =
      verificarToken(partes[1]);


    // ------------------------------------
    // Comprobar el identificador
    //
    // sub viaja como texto. Se exige que sea
    // un entero positivo antes de usarlo en
    // una consulta.
    // ------------------------------------

    if (
      typeof payload.sub !== "string" ||
      !/^[1-9]\d*$/.test(payload.sub)
    ) {

      return res
        .status(401)
        .json({

          mensaje:
            "Token inválido"
        });
    }


    // ------------------------------------
    // Consultar la identidad real
    // ------------------------------------

    const usuario =
      await usuariosService
        .obtenerUsuarioPorId(
          payload.sub
        );


    if (!usuario) {

      return res
        .status(401)
        .json({

          mensaje:
            "La cuenta asociada al token no existe"
        });
    }


    // ------------------------------------
    // Comprobar estado de la cuenta
    //
    // 403 y no 401: sabemos quién es, pero
    // su cuenta está deshabilitada.
    // ------------------------------------

    if (!usuario.activo) {

      return res
        .status(403)
        .json({

          mensaje:
            "Usuario deshabilitado"
        });
    }


    // ------------------------------------
    // Version de sesion (Bloque 11)
    //
    // Un token sigue siendo valido por su
    // firma aunque la contrasena haya
    // cambiado. Comparar la version que
    // lleva el token con la que guarda la
    // base es lo que revoca las sesiones
    // anteriores a ese cambio.
    //
    // Se exige entero seguro: un token sin
    // vs, o con basura, no pasa.
    // ------------------------------------

    if (
      !Number.isSafeInteger(payload.vs) ||
      payload.vs !== usuario.versionSesion
    ) {

      return res
        .status(401)
        .json({

          mensaje:
            "Sesión revocada"
        });
    }


    // ------------------------------------
    // Usar el rol vigente en PostgreSQL
    //
    // No el que venía dentro del token: si a
    // alguien le bajaron el rol, su token
    // antiguo deja de darle el privilegio.
    // ------------------------------------

    req.usuario = {

      id:
        String(usuario.id),

      email:
        usuario.email,

      rol:
        usuario.rol
    };


    return next();

  } catch (error) {

    // ------------------------------------
    // Error que no viene del token
    //
    // Por ejemplo, que falte JWT_SECRET o que
    // la base de datos no responda. Eso es un
    // problema del servidor, no una credencial
    // mala, y responder 401 lo estaría
    // ocultando.
    // ------------------------------------

    if (
      !ERRORES_DE_TOKEN.includes(
        error.name
      )
    ) {
      return next(error);
    }


    // ------------------------------------
    // Token caducado
    // ------------------------------------

    if (
      error.name ===
      "TokenExpiredError"
    ) {

      return res
        .status(401)
        .json({

          mensaje:
            "Token expirado"
        });
    }


    // ------------------------------------
    // Firma inválida o token mal formado
    // ------------------------------------

    return res
      .status(401)
      .json({

        mensaje:
          "Token inválido"
      });
  }
};


module.exports = autenticarJWT;
