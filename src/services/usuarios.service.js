
const {
  consultar,
  pool
} = require("../config/database");

const {
  generarPasswordHash,
  verificarPassword
} = require("../utils/password.util");

// ========================================
// Roles válidos
//
// Lista de roles que existen en el sistema.
// Unica fuente de verdad del dominio.
//
// En la base de datos viven en public.roles;
// esta constante los nombra desde el codigo.
// ========================================

const ROLES = [
  "administrador",
  "medico",
  "paciente"
];


// ========================================
// Rol por defecto al registrarse
//
// El menos privilegiado de los tres. Todo
// usuario creado por el registro publico
// nace con este rol.
// ========================================

const ROL_POR_DEFECTO = "paciente";


// ========================================
// Roles que puede asignar un administrador
//
// Los pacientes se crean por el registro
// publico, no por la operacion administrativa.
// ========================================

const ROLES_ADMINISTRABLES = ROLES.filter(
  (rol) => rol !== ROL_POR_DEFECTO
);


// ========================================
// Columnas compatibles con la API
// ========================================

const columnasUsuario = `
  u.id,
  u.nombre,
  u.email,
  u.password_hash AS "passwordHash",
  r.nombre AS rol,
  u.activo,
  u.version_sesion AS "versionSesion"
`;

// ========================================
// Obtener usuario por email
// ========================================

const obtenerUsuarioPorEmail = async (email) => {
  const resultado = await consultar(
    `SELECT ${columnasUsuario}
     FROM public.usuarios u
     INNER JOIN public.roles r
       ON r.id = u.rol_id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [email]
  );

  return resultado.rows[0] ?? null;
};

// ========================================
// Obtener usuario por ID
// ========================================

const obtenerUsuarioPorId = async (id) => {
  const resultado = await consultar(
    `SELECT ${columnasUsuario}
     FROM public.usuarios u
     INNER JOIN public.roles r
       ON r.id = u.rol_id
     WHERE u.id = $1`,
    [id]
  );

  return resultado.rows[0] ?? null;
};

// ========================================
// Inserción controlada de usuario
// ========================================

const insertarUsuario = async ({
  nombre,
  email,
  password,
  rol
}) => {
  const passwordHash =
    await generarPasswordHash(password);

  const resultado = await consultar(
    `WITH insertado AS (
       INSERT INTO public.usuarios (
         nombre,
         email,
         password_hash,
         rol_id,
         activo
       )
       SELECT
         $1,
         LOWER($2),
         $3,
         r.id,
         TRUE
       FROM public.roles r
       WHERE r.nombre = $4
         AND r.activo = TRUE
       RETURNING *
     )
     SELECT
       i.id,
       i.nombre,
       i.email,
       i.password_hash AS "passwordHash",
       r.nombre AS rol,
       i.activo
     FROM insertado i
     INNER JOIN public.roles r
       ON r.id = i.rol_id`,
    [nombre, email, passwordHash, rol]
  );

  if (resultado.rows.length === 0) {
    const error = new Error(
      "El rol solicitado no existe o está inactivo"
    );
    error.codigoAplicacion = "ROL_INVALIDO";
    throw error;
  }

  return resultado.rows[0];
};

// ========================================
// Registro público
// El cliente NO decide el rol
// ========================================

const crearUsuario = async (datos) => {
  return insertarUsuario({
    nombre: datos.nombre,
    email: datos.email,
    password: datos.password,
    rol: ROL_POR_DEFECTO
  });
};

// ========================================
// Creación administrativa
// ========================================

const crearUsuarioAdministrativo = async (datos) => {
  if (!ROLES_ADMINISTRABLES.includes(datos.rol)) {
    const error = new Error(
      "Rol no permitido para esta operación"
    );
    error.codigoAplicacion = "ROL_INVALIDO";
    throw error;
  }

  return insertarUsuario({
    nombre: datos.nombre,
    email: datos.email,
    password: datos.password,
    rol: datos.rol
  });
};

// ========================================
// Verificar credenciales
// ========================================

const verificarCredenciales = async (
  email,
  password
) => {
  const usuario =
    await obtenerUsuarioPorEmail(email);

  if (!usuario) {
    return null;
  }

  if (!usuario.passwordHash) {
    return null;
  }

  const passwordValida =
    await verificarPassword(
      password,
      usuario.passwordHash
    );

  if (!passwordValida) {
    return null;
  }

  return usuario;
};

// ========================================
// Cambio de contrasena por el propio usuario
//
// Devuelve un estado, no un booleano: quien
// llama necesita distinguir "clave actual
// incorrecta" de "es la misma de antes".
//
// El UPDATE incrementa version_sesion en la
// misma sentencia, asi que los JWT emitidos
// antes quedan revocados sin ventana.
//
// La condicion password_hash = $3 evita
// pisar un cambio simultaneo: si otra
// peticion cambio la clave entre la lectura
// y el UPDATE, no afecta ninguna fila.
// ========================================

const cambiarPasswordPropio = async (
  usuarioId,
  passwordActual,
  passwordNueva
) => {

  const usuario =
    await obtenerUsuarioPorId(usuarioId);

  if (
    !usuario ||
    !usuario.activo ||
    !usuario.passwordHash
  ) {
    return { estado: "NO_AUTORIZADO" };
  }

  const actualValida =
    await verificarPassword(
      passwordActual,
      usuario.passwordHash
    );

  if (!actualValida) {
    return { estado: "CLAVE_INCORRECTA" };
  }

  const esLaMisma =
    await verificarPassword(
      passwordNueva,
      usuario.passwordHash
    );

  if (esLaMisma) {
    return { estado: "MISMA_CLAVE" };
  }

  const nuevoHash =
    await generarPasswordHash(passwordNueva);

  const resultado = await consultar(
    `UPDATE public.usuarios
     SET password_hash = $1,
         version_sesion = version_sesion + 1
     WHERE id = $2
       AND activo = TRUE
       AND password_hash = $3
     RETURNING id`,
    [nuevoHash, usuarioId, usuario.passwordHash]
  );

  return resultado.rowCount === 1
    ? { estado: "OK" }
    : { estado: "CONFLICTO" };
};


// ========================================
// Bootstrap del administrador inicial
//
// Crea EXCLUSIVAMENTE el primer
// administrador del sistema.
//
// Decision de diseno (Bloque 7.5.1):
// la comprobacion es "existe algun
// administrador?", no "existe este
// correo?". Con la comprobacion por
// correo, cambiar ADMIN_EMAIL en el .env
// creaba un segundo administrador en
// silencio.
//
// No reinicia contrasenas, no activa
// cuentas y no eleva privilegios de una
// cuenta existente.
// ========================================

const crearAdministradorInicial = async () => {

  const nombre =
    process.env.ADMIN_NOMBRE?.trim();

  const email =
    process.env.ADMIN_EMAIL
      ?.trim()
      .toLowerCase();

  const password = process.env.ADMIN_PASSWORD;

  if (!nombre || !email || !password) {
    throw new Error(
      "Faltan las variables ADMIN_NOMBRE, " +
      "ADMIN_EMAIL o ADMIN_PASSWORD"
    );
  }

  if (password.length < 12) {
    throw new Error(
      "La contrasena inicial debe tener " +
      "al menos 12 caracteres"
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error(
      "ADMIN_EMAIL no tiene un formato valido"
    );
  }

  // El hash se calcula ANTES de abrir la
  // transaccion: bcrypt con coste 12 tarda,
  // y no conviene sostener el bloqueo
  // mientras tanto.

  const passwordHash =
    await generarPasswordHash(password);

  const cliente = await pool.connect();

  let transaccionIniciada = false;

  try {

    await cliente.query("BEGIN");

    transaccionIniciada = true;

    // Bloqueo asesor: serializa ejecuciones
    // simultaneas de ESTE bootstrap. No
    // protege otros endpoints que inserten
    // administradores.

    await cliente.query(
      "SELECT pg_advisory_xact_lock($1, $2)",
      [7505, 1]
    );

    // Cualquier administrador cuenta,
    // incluso uno inactivo.

    const administradores =
      await cliente.query(
        `SELECT
           u.id
         FROM public.usuarios u
         INNER JOIN public.roles r
           ON r.id = u.rol_id
         WHERE r.nombre = 'administrador'
         ORDER BY u.id
         LIMIT 1`
      );

    if (administradores.rows.length > 0) {

      await cliente.query("COMMIT");

      transaccionIniciada = false;

      return {
        creado: false,
        motivo: "ADMINISTRADOR_EXISTENTE"
      };
    }

    // Si el correo ya pertenece a otra
    // cuenta, no se la convierte en
    // administrador.

    const correoExistente =
      await cliente.query(
        `SELECT id
         FROM public.usuarios
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [email]
      );

    if (correoExistente.rows.length > 0) {
      throw new Error(
        "El correo de bootstrap ya pertenece " +
        "a otro usuario. No se elevaran " +
        "privilegios."
      );
    }

    const rolResultado = await cliente.query(
      `SELECT id
       FROM public.roles
       WHERE nombre = 'administrador'
         AND activo = TRUE
       LIMIT 1`
    );

    if (rolResultado.rows.length === 0) {
      throw new Error(
        "No existe un rol administrador activo"
      );
    }

    const rolId = rolResultado.rows[0].id;

    const resultado = await cliente.query(
      `INSERT INTO public.usuarios (
         nombre,
         email,
         password_hash,
         rol_id,
         activo
       )
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING
         id,
         nombre,
         activo`,
      [nombre, email, passwordHash, rolId]
    );

    await cliente.query("COMMIT");

    transaccionIniciada = false;

    return {
      creado: true,
      motivo: "ADMINISTRADOR_CREADO",
      usuario: resultado.rows[0]
    };

  } catch (error) {

    if (transaccionIniciada) {
      try {
        await cliente.query("ROLLBACK");
      } catch (errorRollback) {
        console.error(
          "Error al revertir bootstrap:",
          errorRollback.message
        );
      }
    }

    throw error;

  } finally {
    cliente.release();
  }
};


module.exports = {
  ROLES,
  ROL_POR_DEFECTO,
  obtenerUsuarioPorEmail,
  obtenerUsuarioPorId,
  crearUsuario,
  crearUsuarioAdministrativo,
  verificarCredenciales,
  cambiarPasswordPropio,
  crearAdministradorInicial
};
