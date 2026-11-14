const jwt =
  require(
    "jsonwebtoken"
  );


// ========================================
// Tiempo de vida por defecto
//
// Se usa si JWT_EXPIRES_IN no está en .env.
// ========================================

const EXPIRACION_POR_DEFECTO = "1h";


// ========================================
// Algoritmo de firma
//
// Fijo a propósito. Se impone al firmar y
// al verificar, para no aceptar el que
// venga indicado en el propio token.
// ========================================

const ALGORITMO = "HS256";


// ========================================
// Obtener el secreto de firma
//
// Sale de .env, nunca del código. Si falta,
// se lanza error en vez de firmar con algo
// vacío o inventado.
// ========================================

const obtenerSecreto = () => {

  const secreto =
    process.env.JWT_SECRET;


  if (!secreto) {

    throw new Error(
      "JWT_SECRET no está configurado"
    );
  }


  return secreto;
};


// ========================================
// Obtener el tiempo de expiración
// ========================================

const obtenerExpiracion = () => {

  return (
    process.env.JWT_EXPIRES_IN ||
    EXPIRACION_POR_DEFECTO
  );
};


// ========================================
// Generar JWT
//
// OJO: el payload NO va cifrado. Va en
// base64 y cualquiera que tenga el token
// puede leerlo sin conocer el secreto.
// La firma sirve para detectar que nadie
// lo alteró, no para ocultar su contenido.
//
// Por eso aquí solo van email y rol, más el
// id en subject. Nunca la contraseña ni el
// passwordHash.
// ========================================

const generarToken = (
  usuario
) => {

  const secreto =
    obtenerSecreto();


  const payload = {

    email:
      usuario.email,

    rol:
      usuario.rol,

    // Version de sesion (Bloque 11).
    //
    // Al cambiar o restablecer la contrasena,
    // usuarios.version_sesion se incrementa.
    // El middleware compara este valor con el
    // de la base: los tokens emitidos antes
    // del cambio dejan de servir.
    vs:
      usuario.versionSesion
  };


  return jwt.sign(
    payload,
    secreto,
    {
      algorithm:
        ALGORITMO,

      subject:
        String(usuario.id),

      expiresIn:
        obtenerExpiracion()
    }
  );
};


// ========================================
// Verificar JWT
//
// Comprueba la firma y la expiración.
//
// algorithms queda restringido a HS256 a
// propósito: si no se restringe, un atacante
// puede mandar un token que declare
// "alg": "none" y colarlo sin firma.
// ========================================

const verificarToken = (
  token
) => {

  const secreto =
    obtenerSecreto();


  return jwt.verify(
    token,
    secreto,
    {
      algorithms: [
        ALGORITMO
      ]
    }
  );
};


module.exports = {
  obtenerSecreto,
  generarToken,
  verificarToken
};
