const { consultar } = require("../config/database");

// ========================================
// Columnas de salida
// ========================================

const columnas = `
  id,
  numero,
  piso,
  tipo,
  estado
`;

// ========================================
// GET - Todas las habitaciones
// ========================================

const obtenerHabitaciones = async () => {
  const resultado = await consultar(`
    SELECT ${columnas}
    FROM public.habitaciones
    ORDER BY piso, numero
  `);

  return resultado.rows;
};

// ========================================
// GET - Habitaciones disponibles
// ========================================

const obtenerHabitacionesDisponibles = async () => {
  const resultado = await consultar(`
    SELECT ${columnas}
    FROM public.habitaciones
    WHERE estado = 'disponible'
    ORDER BY piso, numero
  `);

  return resultado.rows;
};

// ========================================
// GET - Habitacion por ID
// ========================================

const obtenerHabitacionPorId = async (id) => {
  const resultado = await consultar(
    `SELECT ${columnas}
     FROM public.habitaciones
     WHERE id = $1`,
    [id]
  );

  return resultado.rows[0] ?? null;
};

// ========================================
// Buscar por numero
// ========================================

const buscarHabitacionPorNumero = async (numero) => {
  const resultado = await consultar(
    `SELECT ${columnas}
     FROM public.habitaciones
     WHERE LOWER(numero) = LOWER($1)
     LIMIT 1`,
    [numero]
  );

  return resultado.rows[0] ?? null;
};

// ========================================
// Ingreso activo de la habitacion
// ========================================

const habitacionTieneIngresoActivo = async (id) => {
  const resultado = await consultar(
    `SELECT EXISTS (
       SELECT 1
       FROM public.ingresos
       WHERE habitacion_id = $1
         AND fecha_alta IS NULL
     ) AS existe`,
    [id]
  );

  return resultado.rows[0].existe;
};

// ========================================
// POST - Crear habitacion
// ========================================

const crearHabitacion = async (datos) => {
  const resultado = await consultar(
    `INSERT INTO public.habitaciones (
       numero, piso, tipo, estado
     )
     VALUES ($1, $2, $3, $4)
     RETURNING ${columnas}`,
    [
      datos.numero,
      datos.piso,
      datos.tipo,
      datos.estado ?? "disponible"
    ]
  );

  return resultado.rows[0];
};

// ========================================
// PUT - Actualizar habitacion
// ========================================

const actualizarHabitacion = async (id, datos) => {
  const resultado = await consultar(
    `UPDATE public.habitaciones
     SET numero = $2,
         piso = $3,
         tipo = $4,
         estado = $5
     WHERE id = $1
     RETURNING ${columnas}`,
    [
      id,
      datos.numero,
      datos.piso,
      datos.tipo,
      datos.estado
    ]
  );

  return resultado.rows[0] ?? null;
};

module.exports = {
  obtenerHabitaciones,
  obtenerHabitacionesDisponibles,
  obtenerHabitacionPorId,
  buscarHabitacionPorNumero,
  habitacionTieneIngresoActivo,
  crearHabitacion,
  actualizarHabitacion
};
