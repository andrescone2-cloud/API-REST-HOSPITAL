import { api, invalidar, textoError } from "./api.js";
import {
  h,
  vaciar,
  tabla,
  textoPlano,
  vacio,
  cabeceraVista,
  boton,
  aviso,
  confirmar,
  modalFormulario
} from "./ui.js";

// ========================================
// Valores iniciales de un formulario de
// edicion a partir de la fila de la API
// ========================================

const valoresDeFila = (campos, fila) => {
  const valores = {};

  for (const campo of campos) {
    let valor = fila[campo.nombre];

    if (valor != null) {
      if (campo.tipo === "date") {
        valor = String(valor).slice(0, 10);
      } else if (campo.tipo === "time") {
        valor = String(valor).slice(0, 5);
      }
    }

    valores[campo.nombre] = valor;
  }

  return valores;
};

// ========================================
// Vista CRUD generica
//
// cfg: {
//   titulo, subtitulo, singular,
//   listar        (ruta o funcion(ctx) -> ruta),
//   endpoint      (para crear / editar / borrar),
//   escribe       roles que pueden crear/editar/borrar,
//   metodoEditar  "PATCH" (por defecto) o "PUT",
//   eliminar      false para ocultar "Eliminar",
//   invalidar     claves de catalogo a refrescar al cambiar,
//   cargarAux     async (ctx) -> { ...catalogos },
//   columnas      (ctx, aux) -> [{ titulo, celda(fila) }],
//   campos        (aux, fila, ctx) -> campos del formulario,
//   valoresEdicion (fila) -> valores iniciales,
//   filtros       [{ clave, etiqueta, opciones: [{ valor, etiqueta }] }],
//   acciones      (fila, ctx, aux) -> botones extra por fila
//   separar       (valores) -> { ficha, extra }: aparta del envio los
//                 campos que no pertenecen al recurso
//   claveRespuesta clave del recurso en la respuesta del POST
//   alGuardar     async (id, extra, fila, ficha): paso posterior al
//                 guardado (por ejemplo, crear una cuenta de acceso)
// }
// ========================================

export const crudVista = (cfg) => async (ctx) => {
  const ruta = typeof cfg.listar === "function" ? cfg.listar(ctx) : cfg.listar ?? cfg.endpoint;

  const [filas, aux] = await Promise.all([
    api("GET", ruta),
    cfg.cargarAux ? cfg.cargarAux(ctx) : {}
  ]);

  const puedeEscribir = (cfg.escribe ?? []).includes(ctx.rol) && Boolean(cfg.campos);
  const columnas = cfg.columnas(ctx, aux);
  const estadoFiltros = {};
  let busqueda = "";

  const alCambiar = () => {
    invalidar(...(cfg.invalidar ?? []));
    ctx.recargar();
  };

  // ---------- crear / editar / borrar ----------

  const abrirCrear = () =>
    modalFormulario({
      titulo: `Nuevo ${cfg.singular}`,
      campos: cfg.campos(aux, null, ctx),
      textoEnviar: "Crear",
      enviar: async (valores) => {
        const { ficha, extra } = cfg.separar ? cfg.separar(valores) : { ficha: valores, extra: {} };
        const respuesta = await api("POST", cfg.endpoint, ficha);
        aviso(respuesta?.mensaje ?? "Registro creado");

        if (cfg.alGuardar) {
          await cfg.alGuardar(respuesta?.[cfg.claveRespuesta]?.id, extra, null, ficha);
        }

        alCambiar();
      }
    });

  const abrirEditar = (fila) => {
    const campos = cfg.campos(aux, fila, ctx);

    modalFormulario({
      titulo: `Editar ${cfg.singular}`,
      campos,
      valores: cfg.valoresEdicion ? cfg.valoresEdicion(fila) : valoresDeFila(campos, fila),
      enviar: async (valores) => {
        const { ficha, extra } = cfg.separar ? cfg.separar(valores) : { ficha: valores, extra: {} };
        const respuesta = await api(
          cfg.metodoEditar ?? "PATCH",
          `${cfg.endpoint}/${fila.id}`,
          ficha
        );
        aviso(respuesta?.mensaje ?? "Registro actualizado");

        if (cfg.alGuardar) {
          await cfg.alGuardar(fila.id, extra, fila, ficha);
        }

        alCambiar();
      }
    });
  };

  const borrar = async (fila) => {
    const si = await confirmar({
      titulo: `Eliminar ${cfg.singular}`,
      mensaje: `¿Eliminar este ${cfg.singular}? Esta acción no se puede deshacer.`,
      textoOk: "Eliminar",
      peligro: true
    });

    if (!si) {
      return;
    }

    try {
      const respuesta = await api("DELETE", `${cfg.endpoint}/${fila.id}`);
      aviso(respuesta?.mensaje ?? "Registro eliminado");
      alCambiar();
    } catch (error) {
      aviso(textoError(error), "error", 7000);
    }
  };

  // ---------- pintado ----------

  const zona = h("div");

  const accionesFila = (fila) => [
    ...(cfg.acciones ? cfg.acciones(fila, ctx, aux, alCambiar) : []),
    puedeEscribir ? boton("Editar", () => abrirEditar(fila), "btn-ghost btn-sm") : null,
    puedeEscribir && cfg.eliminar !== false
      ? boton("Eliminar", () => borrar(fila), "btn-ghost btn-sm")
      : null
  ];

  const hayAcciones = puedeEscribir || Boolean(cfg.acciones);

  const pintar = () => {
    const visibles = filas.filter((fila) => {
      for (const filtro of cfg.filtros ?? []) {
        const elegido = estadoFiltros[filtro.clave];

        if (elegido && String(fila[filtro.clave]) !== elegido) {
          return false;
        }
      }

      if (busqueda === "") {
        return true;
      }

      return columnas
        .map((c) => textoPlano(c.celda(fila)))
        .join(" ")
        .toLowerCase()
        .includes(busqueda);
    });

    vaciar(zona);

    if (visibles.length === 0) {
      zona.append(
        vacio(
          filas.length === 0 ? `Aún no hay ${cfg.plural ?? "registros"}` : "Sin resultados",
          filas.length === 0 && puedeEscribir
            ? `Use «Nuevo ${cfg.singular}» para agregar el primero.`
            : "Pruebe con otra búsqueda o filtro."
        )
      );
      return;
    }

    zona.append(tabla(columnas, visibles, hayAcciones ? { acciones: accionesFila } : {}));
  };

  const barra = h(
    "div",
    { class: "barra-herramientas" },
    h("input", {
      type: "search",
      placeholder: "Buscar…",
      "aria-label": "Buscar",
      oninput: (evento) => {
        busqueda = evento.target.value.trim().toLowerCase();
        pintar();
      }
    }),
    (cfg.filtros ?? []).map((filtro) =>
      h(
        "select",
        {
          "aria-label": filtro.etiqueta,
          onchange: (evento) => {
            estadoFiltros[filtro.clave] = evento.target.value;
            pintar();
          }
        },
        h("option", { value: "", text: `${filtro.etiqueta}: todos` }),
        filtro.opciones.map((o) => h("option", { value: String(o.valor), text: o.etiqueta }))
      )
    ),
    h("span", { class: "texto-suave", text: `${filas.length} en total` })
  );

  pintar();

  return h(
    "section",
    {},
    cabeceraVista(
      cfg.titulo,
      cfg.subtitulo,
      puedeEscribir ? boton(`Nuevo ${cfg.singular}`, abrirCrear, "btn-primary") : null
    ),
    barra,
    zona
  );
};
