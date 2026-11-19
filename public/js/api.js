import { API_BASE } from "./config.js";

// ========================================
// Sesion
//
// El token JWT y los datos del usuario viven
// en sessionStorage: se borran al cerrar la
// pestana. El navegador NO usa API Key: el
// login es publico y los recursos se
// protegen con el token.
// ========================================

const guardar = (almacen, clave, valor) => {
  try {
    if (valor == null) {
      almacen.removeItem(clave);
    } else {
      almacen.setItem(clave, valor);
    }
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
};

const leer = (almacen, clave) => {
  try {
    return almacen.getItem(clave);
  } catch {
    return null;
  }
};

export const sesion = {
  get token() {
    return leer(sessionStorage, "token");
  },

  get usuario() {
    try {
      return JSON.parse(leer(sessionStorage, "usuario") ?? "null");
    } catch {
      return null;
    }
  },

  iniciar(token, usuario) {
    guardar(sessionStorage, "token", token);
    guardar(sessionStorage, "usuario", JSON.stringify(usuario));
  },

  cerrar() {
    guardar(sessionStorage, "token", null);
    guardar(sessionStorage, "usuario", null);
    memo.clear();
  }
};

// ========================================
// Errores
// ========================================

export class ApiError extends Error {
  constructor(status, mensaje, detalles = []) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

// ========================================
// Peticion
// ========================================

export const api = async (metodo, ruta, cuerpo, opciones = {}) => {
  const cabeceras = { Accept: "application/json" };

  if (cuerpo !== undefined) {
    cabeceras["Content-Type"] = "application/json";
  }

  if (sesion.token && !opciones.sinToken) {
    cabeceras.Authorization = `Bearer ${sesion.token}`;
  }

  let respuesta;

  try {
    respuesta = await fetch(API_BASE + ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. ¿La API está en ejecución?");
  }

  let datos = null;

  try {
    datos = await respuesta.json();
  } catch {
    /* respuesta sin cuerpo JSON */
  }

  if (!respuesta.ok) {
    const error = new ApiError(
      respuesta.status,
      datos?.mensaje ?? `Error ${respuesta.status}`,
      Array.isArray(datos?.errores) ? datos.errores : []
    );

    // Un 401 con sesion iniciada significa token vencido o revocado.
    if (respuesta.status === 401 && sesion.token && !opciones.sinToken) {
      window.dispatchEvent(new CustomEvent("sesion-expirada"));
    }

    throw error;
  }

  return datos;
};

// ========================================
// Catalogos en memoria
//
// Listas que se usan para llenar selects y
// mostrar nombres. Se piden una vez y se
// invalidan cuando algo cambia.
// ========================================

const memo = new Map();

export const catalogo = (clave, ruta) => {
  if (!memo.has(clave)) {
    const promesa = api("GET", ruta).catch((error) => {
      memo.delete(clave);
      throw error;
    });

    memo.set(clave, promesa);
  }

  return memo.get(clave);
};

// Igual que catalogo(), pero un fallo (por ejemplo, sin permiso)
// devuelve una lista vacia en lugar de romper la pantalla.
export const catalogoOpcional = (clave, ruta) =>
  catalogo(clave, ruta).catch(() => []);

export const invalidar = (...claves) => {
  for (const clave of claves) {
    memo.delete(clave);
  }
};

export const invalidarTodo = () => memo.clear();

// ========================================
// Texto de un error para mostrar
// ========================================

export const textoError = (error) => {
  if (!(error instanceof ApiError)) {
    return error?.message ?? "Ocurrió un error inesperado";
  }

  if (error.detalles.length > 0) {
    return `${error.message}: ${error.detalles
      .map((d) => d.msg)
      .filter(Boolean)
      .join("; ")}`;
  }

  return error.message;
};
