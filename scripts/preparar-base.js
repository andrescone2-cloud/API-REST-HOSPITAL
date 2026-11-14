// ============================================================
// Preparar la base de datos en Supabase
//
// Ejecuta en orden:
//   database/01_esquema_hospital.sql
//   database/02_roles_seguridad.sql
//   database/03_verificacion.sql
//
// Lee DATABASE_URL de .env. No imprime nunca la cadena de
// conexion ni la contrasena.
//
// Uso:
//   node scripts/preparar-base.js
// ============================================================

const fs = require("node:fs");
const path = require("node:path");

const {
  pool,
  consultar
} = require("../src/config/database");


const DIR = path.resolve(
  __dirname,
  "../database"
);


// ========================================
// Comprobar si el esquema ya existe
// ========================================

const tablasEsperadas = [
  "roles",
  "usuarios",
  "pacientes",
  "medicos",
  "especialidades",
  "consultorios",
  "citas"
];


const contarTablas = async () => {

  const r = await consultar(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)`,
    [tablasEsperadas]
  );

  return r.rows.length;
};


// ========================================
// Ejecutar un archivo .sql completo
// ========================================

const ejecutarArchivo = async (
  nombre
) => {

  const sql = fs.readFileSync(
    path.join(DIR, nombre),
    "utf8"
  );

  process.stdout.write(
    "  " + nombre.padEnd(30)
  );

  try {

    await consultar(sql);

    console.log("OK");

    return true;

  } catch (error) {

    console.log("FALLO");
    console.log("    " + error.message);

    return false;
  }
};


// ========================================
// Verificacion final
// ========================================

const verificar = async () => {

  console.log("");
  console.log("VERIFICACION");
  console.log("");

  const roles = await consultar(
    `SELECT id, nombre, activo
       FROM public.roles
      ORDER BY id`
  );

  console.log("  Roles de negocio:");

  for (const r of roles.rows) {
    console.log(
      "    " + r.id + "  " +
      r.nombre.padEnd(16) + r.activo
    );
  }

  const tablas = await consultar(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
      ORDER BY table_name`,
    [tablasEsperadas]
  );

  console.log("");
  console.log(
    "  Tablas (" + tablas.rows.length + " de 7): " +
    tablas.rows.map((t) => t.table_name).join(", ")
  );

  const rls = await consultar(
    `SELECT relname AS tabla,
            relrowsecurity AS rls
       FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname = ANY($1)
      ORDER BY relname`,
    [tablasEsperadas]
  );

  const conRls = rls.rows.filter(
    (t) => t.rls
  ).length;

  console.log(
    "  RLS habilitado en " + conRls +
    " de " + rls.rows.length + " tablas"
  );

  const fks = await consultar(
    `SELECT COUNT(*)::int AS total
       FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema = 'public'`
  );

  console.log(
    "  Claves foraneas: " + fks.rows[0].total
  );

  return {
    roles: roles.rows.length,
    tablas: tablas.rows.length,
    rls: conRls,
    fks: fks.rows[0].total
  };
};


// ========================================
// Flujo
// ========================================

const principal = async () => {

  console.log("");
  console.log("Preparando la base de datos de API Hospital");
  console.log("");

  const ya = await contarTablas();

  if (ya > 0) {

    console.log(
      "  Ya existen " + ya + " de las 7 tablas."
    );
    console.log(
      "  01_esquema_hospital.sql NO es idempotente, se omite."
    );
    console.log(
      "  Se ejecuta solo la verificacion."
    );

    const r = await verificar();

    await pool.end();

    return r.tablas === 7 ? 0 : 1;
  }

  console.log("EJECUTANDO SCRIPTS");
  console.log("");

  for (const f of [
    "01_esquema_hospital.sql",
    "02_roles_seguridad.sql"
  ]) {

    const ok = await ejecutarArchivo(f);

    if (!ok) {
      await pool.end();
      return 1;
    }
  }

  const r = await verificar();

  await pool.end();

  const bien =
    r.tablas === 7 &&
    r.roles === 3 &&
    r.rls === 7;

  console.log("");
  console.log(
    bien
      ? "Base de datos lista."
      : "Revisar: algo no quedo como se esperaba."
  );

  return bien ? 0 : 1;
};


principal()
  .then((c) => process.exit(c))
  .catch((error) => {
    console.error("");
    console.error("Error:", error.message);
    process.exit(1);
  });
