// ============================================================
// Aplicar la migracion de la especificacion del Hospital
//
// Ejecuta database/04_migracion_especificacion.sql y
// database/05_trazabilidad_ingresos.sql y
// database/06_historial_recetas.sql sobre la base
// que indique DATABASE_URL (.env). Es idempotente: se puede
// repetir sin danar nada, y NO borra datos.
//
// Agrega: pacientes.tipo_sangre/alergias, medicos.documento/estado,
// citas 'atendida' -> 'completada', y las tablas habitaciones e
// ingresos.
//
// Uso:
//   node scripts/migrar-especificacion.js
// ============================================================

const fs = require("node:fs");
const path = require("node:path");

const { pool, consultar } = require("../src/config/database");

const ARCHIVOS = [
  "04_migracion_especificacion.sql",
  "05_trazabilidad_ingresos.sql",
  "06_historial_recetas.sql"
].map((nombre) => path.resolve(__dirname, "../database", nombre));

const tablasNuevas = [
  "habitaciones",
  "ingresos",
  "historial_medico",
  "recetas",
  "receta_medicamentos"
];

const main = async () => {
  for (const archivo of ARCHIVOS) {
    console.log(`Aplicando ${path.basename(archivo)} ...`);

    await consultar(fs.readFileSync(archivo, "utf8"));
  }

  console.log("  Migraciones aplicadas.\n");

  const tablas = await consultar(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)`,
    [tablasNuevas]
  );

  const columnas = await consultar(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'pacientes' AND column_name IN ('tipo_sangre', 'alergias'))
          OR
          (table_name = 'medicos' AND column_name IN ('documento', 'estado'))
          OR
          (table_name = 'ingresos' AND column_name IN ('registrado_por', 'alta_por', 'creado_en'))
        )
      ORDER BY table_name, column_name`
  );

  console.log("Verificacion:");
  console.log(
    "  Tablas nuevas:",
    tablas.rows.map((r) => r.table_name).join(", ") || "(ninguna)"
  );
  console.log(
    "  Columnas nuevas:",
    columnas.rows
      .map((r) => `${r.table_name}.${r.column_name}`)
      .join(", ") || "(ninguna)"
  );

  const completo =
    tablas.rows.length === tablasNuevas.length &&
    columnas.rows.length === 7;

  console.log(
    completo
      ? "\nTodo listo. Ya puede iniciar la API con: npm start"
      : "\nAtencion: la verificacion no encontro todos los objetos."
  );

  process.exitCode = completo ? 0 : 1;
};

main()
  .catch((error) => {
    console.error("\nNo se pudo aplicar la migracion:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
