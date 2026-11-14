
const { Pool } = require("pg");
const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Falta DATABASE_URL en el archivo .env"
  );
}

// Ruta al certificado descargado desde Supabase
const rutaCertificado = path.resolve(
  __dirname,
  "../../certs/prod-ca-2021.crt"
);

if (!fs.existsSync(rutaCertificado)) {
  throw new Error(
    "No se encontró el certificado SSL de Supabase"
  );
}

const certificado = fs.readFileSync(
  rutaCertificado,
  "utf8"
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    ca: certificado,
    rejectUnauthorized: true
  },

  max: 5,

  // INC-001: una peticion fallo con 500 porque pg-pool entrego un
  // socket que el pooler ya habia cerrado (ECONNRESET al leer).
  //
  // keepAlive hace que el sistema operativo mande sondas TCP sobre
  // la conexion ociosa a partir de los 10 s. Eso mantiene viva la
  // traduccion de direcciones en los equipos intermedios y, si el
  // otro extremo ya no esta, el error aparece en la conexion ociosa
  // y no en mitad de una peticion de un usuario.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,

  // Antes 30 s. Se mide que el pooler tolera al menos 180 s de
  // inactividad, asi que 10 s queda muy por debajo de cualquier
  // cierre del servidor: el pool descarta sus conexiones ociosas
  // mucho antes de que puedan quedarse obsoletas. El coste es
  // reconectar algo mas a menudo, barato con max: 5.
  idleTimeoutMillis: 10000,

  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
  console.error(
    "Error en conexión PostgreSQL inactiva:",
    error.message
  );
});

const consultar = (sql, parametros = []) => {
  return pool.query(sql, parametros);
};

// ========================================
// Cierre ordenado del pool
//
// Lo necesitan los scripts independientes
// (seed:admin, diagnostico RLS): sin esto
// el proceso queda vivo esperando a que
// se cierren las conexiones.
//
// La API no lo llama: su pool vive
// mientras vive el servidor.
// ========================================

const cerrarPool = async () => {
  await pool.end();
};

module.exports = {
  pool,
  consultar,
  cerrarPool
};
