// ========================================
// Constructor de DOM
//
// Todo el contenido dinamico se inserta como
// TEXTO (createTextNode / textContent), nunca
// como HTML: los datos de la API no pueden
// inyectar codigo en la pagina.
// ========================================

const agregar = (elemento, hijos) => {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo == null || hijo === false) {
      continue;
    }

    elemento.append(
      hijo instanceof Node ? hijo : document.createTextNode(String(hijo))
    );
  }
};

export const h = (etiqueta, props = {}, ...hijos) => {
  const elemento = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(props ?? {})) {
    if (valor == null || valor === false) {
      continue;
    }

    if (clave === "class") {
      elemento.className = valor;
    } else if (clave === "text") {
      elemento.textContent = valor;
    } else if (clave === "dataset") {
      Object.assign(elemento.dataset, valor);
    } else if (clave.startsWith("on") && typeof valor === "function") {
      elemento.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else if (valor === true) {
      elemento.setAttribute(clave, "");
    } else {
      elemento.setAttribute(clave, String(valor));
    }
  }

  agregar(elemento, hijos);

  return elemento;
};

export const vaciar = (elemento) => {
  elemento.replaceChildren();
  return elemento;
};

// ========================================
// Formatos
// ========================================

const soloFecha = /^(\d{4})-(\d{2})-(\d{2})/;

// "2026-11-13" o "2026-11-13T05:00:00.000Z" -> "13/11/2026"
export const fmtFecha = (valor) => {
  if (!valor) {
    return "—";
  }

  const m = soloFecha.exec(String(valor));

  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor);
};

export const fmtHora = (valor) => (valor ? String(valor).slice(0, 5) : "—");

export const fmtFechaHora = (valor) => {
  if (!valor) {
    return "—";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return String(valor);
  }

  return fecha.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export const recortar = (texto, max = 60) => {
  if (!texto) {
    return "—";
  }

  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
};

const ETIQUETAS_ESTADO = {
  programada: "Programada",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  disponible: "Disponible",
  ocupada: "Ocupada",
  mantenimiento: "Mantenimiento",
  activa: "Activa",
  dispensada: "Dispensada",
  anulada: "Anulada",
  activo: "Activo",
  inactivo: "Inactivo",
  vacaciones: "Vacaciones",
  enCurso: "En curso"
};

export const insignia = (estado) =>
  h(
    "span",
    { class: `badge badge-${estado}` },
    ETIQUETAS_ESTADO[estado] ?? estado ?? "—"
  );

export const siNo = (valor) => insignia(valor ? "activo" : "inactivo");

// ========================================
// Avisos (toast)
// ========================================

export const aviso = (mensaje, tipo = "ok", ms = 4500) => {
  const contenedor = document.getElementById("toasts");

  const el = h(
    "div",
    { class: `toast toast-${tipo}`, role: tipo === "error" ? "alert" : "status" },
    h("span", { class: "toast-texto" }, mensaje),
    h("button", {
      class: "toast-cerrar",
      type: "button",
      "aria-label": "Cerrar aviso",
      text: "×",
      onclick: () => el.remove()
    })
  );

  contenedor.append(el);

  if (ms > 0) {
    setTimeout(() => el.remove(), ms);
  }

  return el;
};

// ========================================
// Ventana modal
// ========================================

export const modal = ({ titulo, cuerpo, ancho = "md", alCerrar }) => {
  const previo = document.activeElement;

  const cerrar = () => {
    fondo.remove();
    document.removeEventListener("keydown", teclas);
    document.body.classList.remove("sin-scroll");

    if (previo instanceof HTMLElement) {
      previo.focus();
    }

    alCerrar?.();
  };

  const teclas = (evento) => {
    if (evento.key === "Escape") {
      cerrar();
    }
  };

  const fondo = h(
    "div",
    {
      class: "modal-fondo",
      onmousedown: (evento) => {
        if (evento.target === fondo) {
          cerrar();
        }
      }
    },
    h(
      "div",
      {
        class: `modal modal-${ancho}`,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": titulo
      },
      h(
        "div",
        { class: "modal-cabecera" },
        h("h2", { text: titulo }),
        h("button", {
          class: "btn btn-ghost btn-icono",
          type: "button",
          "aria-label": "Cerrar",
          text: "×",
          onclick: cerrar
        })
      ),
      h("div", { class: "modal-cuerpo" }, cuerpo)
    )
  );

  document.body.append(fondo);
  document.body.classList.add("sin-scroll");
  document.addEventListener("keydown", teclas);

  const primero = fondo.querySelector("input, select, textarea, button.btn-primary");

  if (primero) {
    primero.focus();
  }

  return { cerrar, el: fondo };
};

export const confirmar = ({
  titulo,
  mensaje,
  textoOk = "Aceptar",
  peligro = false
}) =>
  new Promise((resolver) => {
    let resuelto = false;

    const terminar = (valor) => {
      if (!resuelto) {
        resuelto = true;
        resolver(valor);
      }
    };

    const ventana = modal({
      titulo,
      ancho: "sm",
      alCerrar: () => terminar(false),
      cuerpo: [
        h("p", { text: mensaje }),
        h(
          "div",
          { class: "acciones" },
          h("button", {
            class: "btn btn-ghost",
            type: "button",
            text: "Cancelar",
            onclick: () => ventana.cerrar()
          }),
          h("button", {
            class: peligro ? "btn btn-danger" : "btn btn-primary",
            type: "button",
            text: textoOk,
            onclick: () => {
              terminar(true);
              ventana.cerrar();
            }
          })
        )
      ]
    });
  });

// ========================================
// Piezas de pantalla
// ========================================

export const cargando = (texto = "Cargando…") =>
  h(
    "div",
    { class: "cargando", role: "status" },
    h("span", { class: "spinner", "aria-hidden": "true" }),
    texto
  );

export const vacio = (texto, detalle) =>
  h(
    "div",
    { class: "vacio" },
    h("p", { class: "vacio-titulo", text: texto }),
    detalle ? h("p", { class: "texto-suave", text: detalle }) : null
  );

export const panelError = (mensaje, reintentar) =>
  h(
    "div",
    { class: "panel-error", role: "alert" },
    h("p", { text: mensaje }),
    reintentar
      ? h("button", {
          class: "btn btn-ghost",
          type: "button",
          text: "Reintentar",
          onclick: reintentar
        })
      : null
  );

export const cabeceraVista = (titulo, subtitulo, acciones) =>
  h(
    "div",
    { class: "vista-cabecera" },
    h(
      "div",
      {},
      h("h1", { text: titulo }),
      subtitulo ? h("p", { class: "texto-suave", text: subtitulo }) : null
    ),
    acciones ? h("div", { class: "acciones" }, acciones) : null
  );

export const boton = (texto, onclick, clase = "btn-ghost", extra = {}) =>
  h("button", { class: `btn ${clase}`, type: "button", onclick, ...extra }, texto);

// ========================================
// Formularios
//
// campo: { nombre, etiqueta, tipo, requerido,
//   opciones: [{ valor, etiqueta }], ayuda,
//   anulable, min, max, maxlength, minlength,
//   pattern, placeholder, step, valor, ancho }
// ========================================

const TIPOS_INPUT = new Set([
  "text",
  "email",
  "number",
  "date",
  "time",
  "datetime-local",
  "password"
]);

export const formulario = (campos, valores = {}) => {
  const controles = new Map();
  const cajaError = h("div", { class: "form-error", role: "alert", hidden: true });

  const crearControl = (campo) => {
    const id = `campo-${campo.nombre}`;
    const inicial = campo.valor ?? valores[campo.nombre];
    let control;

    if (campo.tipo === "select") {
      control = h("select", {
        id,
        name: campo.nombre,
        required: campo.requerido,
        disabled: campo.deshabilitado
      });

      control.append(
        h("option", { value: "", text: campo.requerido ? "Seleccione…" : "— Ninguno —" })
      );

      for (const opcion of campo.opciones ?? []) {
        control.append(
          h("option", { value: String(opcion.valor), text: opcion.etiqueta })
        );
      }

      control.value = inicial == null ? "" : String(inicial);
    } else if (campo.tipo === "textarea") {
      control = h("textarea", {
        id,
        name: campo.nombre,
        rows: campo.filas ?? 3,
        required: campo.requerido,
        maxlength: campo.maxlength,
        minlength: campo.minlength,
        placeholder: campo.placeholder
      });

      control.value = inicial ?? "";
    } else if (campo.tipo === "checkbox") {
      control = h("input", { id, name: campo.nombre, type: "checkbox" });
      control.checked = inicial == null ? Boolean(campo.porDefecto) : Boolean(inicial);
    } else {
      control = h("input", {
        id,
        name: campo.nombre,
        type: TIPOS_INPUT.has(campo.tipo) ? campo.tipo : "text",
        required: campo.requerido,
        min: campo.min,
        max: campo.max,
        step: campo.step,
        maxlength: campo.maxlength,
        minlength: campo.minlength,
        pattern: campo.pattern,
        placeholder: campo.placeholder,
        autocomplete: "off"
      });

      control.value = inicial ?? "";
    }

    controles.set(campo.nombre, { campo, control });

    if (campo.tipo === "checkbox") {
      return h(
        "div",
        { class: "campo campo-check" },
        h("label", { for: id }, control, " ", campo.etiqueta),
        campo.ayuda ? h("small", { class: "texto-suave", text: campo.ayuda }) : null
      );
    }

    return h(
      "div",
      { class: `campo${campo.ancho === "completo" ? " campo-ancho" : ""}` },
      h(
        "label",
        { for: id },
        campo.etiqueta,
        campo.requerido ? h("span", { class: "obligatorio", "aria-hidden": "true" }, " *") : null
      ),
      control,
      campo.ayuda ? h("small", { class: "texto-suave", text: campo.ayuda }) : null
    );
  };

  const el = h(
    "form",
    { class: "formulario", novalidate: false },
    cajaError,
    h("div", { class: "rejilla-campos" }, campos.map(crearControl))
  );

  // Devuelve el objeto a enviar. Los opcionales vacios se omiten
  // (o se envian como null cuando el campo lo admite).
  const leer = () => {
    const salida = {};

    for (const [nombre, { campo, control }] of controles) {
      if (campo.tipo === "checkbox") {
        salida[nombre] = control.checked;
        continue;
      }

      const texto = control.value.trim();

      if (texto === "") {
        if (campo.anulable) {
          salida[nombre] = null;
        }

        continue;
      }

      if (campo.tipo === "number") {
        salida[nombre] = Number(texto);
      } else if (campo.tipo === "datetime-local") {
        salida[nombre] = new Date(texto).toISOString();
      } else {
        salida[nombre] = texto;
      }
    }

    return salida;
  };

  const mostrarError = (error) => {
    cajaError.hidden = false;
    vaciar(cajaError);

    cajaError.append(h("strong", { text: error.message }));

    if (error.detalles?.length) {
      cajaError.append(
        h(
          "ul",
          {},
          error.detalles.map((d) =>
            h("li", {}, d.path ? h("code", { text: d.path }) : null, d.path ? " " : null, d.msg)
          )
        )
      );
    }

    for (const d of error.detalles ?? []) {
      controles.get(d.path)?.control.classList.add("invalido");
    }

    cajaError.scrollIntoView({ block: "nearest" });
  };

  const limpiarError = () => {
    cajaError.hidden = true;

    for (const { control } of controles.values()) {
      control.classList.remove("invalido");
    }
  };

  return { el, leer, mostrarError, limpiarError, controles };
};

// Abre un modal con un formulario y lo conecta al envio.
//   enviar(valores) -> Promise; si lanza, se muestra el error en el form.
export const modalFormulario = ({
  titulo,
  campos,
  valores,
  textoEnviar = "Guardar",
  enviar,
  ancho = "md",
  extra,
  leerExtra
}) => {
  const f = formulario(campos, valores);

  if (extra) {
    f.el.append(extra);
  }

  const boton_ = h("button", {
    class: "btn btn-primary",
    type: "submit",
    text: textoEnviar
  });

  f.el.append(
    h(
      "div",
      { class: "acciones" },
      h("button", {
        class: "btn btn-ghost",
        type: "button",
        text: "Cancelar",
        onclick: () => ventana.cerrar()
      }),
      boton_
    )
  );

  f.el.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    f.limpiarError();

    if (!f.el.reportValidity()) {
      return;
    }

    boton_.disabled = true;
    boton_.textContent = "Guardando…";

    try {
      await enviar({ ...f.leer(), ...(leerExtra ? leerExtra() : {}) });
      ventana.cerrar();
    } catch (error) {
      f.mostrarError(error);
      boton_.disabled = false;
      boton_.textContent = textoEnviar;
    }
  });

  const ventana = modal({ titulo, cuerpo: f.el, ancho });

  return { ventana, formulario: f };
};

// ========================================
// Tabla
//   columnas: [{ titulo, celda(fila) }]
// ========================================

export const tabla = (columnas, filas, { acciones } = {}) =>
  h(
    "div",
    { class: "tabla-envoltura" },
    h(
      "table",
      { class: "tabla" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          columnas.map((c) => h("th", { scope: "col", text: c.titulo })),
          acciones ? h("th", { scope: "col", class: "col-acciones", text: "Acciones" }) : null
        )
      ),
      h(
        "tbody",
        {},
        filas.map((fila) =>
          h(
            "tr",
            { dataset: { buscar: columnas.map((c) => textoPlano(c.celda(fila))).join(" ").toLowerCase() } },
            columnas.map((c) =>
              h("td", { dataset: { etiqueta: c.titulo } }, c.celda(fila))
            ),
            acciones
              ? h("td", { class: "col-acciones", dataset: { etiqueta: "Acciones" } }, h("div", { class: "acciones-fila" }, acciones(fila)))
              : null
          )
        )
      )
    )
  );

export const textoPlano = (valor) => {
  if (valor == null) {
    return "";
  }

  return valor instanceof Node ? valor.textContent : String(valor);
};

// Oculta las filas que no contienen el texto buscado
export const filtrarFilas = (contenedor, texto) => {
  const q = texto.trim().toLowerCase();

  for (const fila of contenedor.querySelectorAll("tbody tr")) {
    fila.hidden = q !== "" && !fila.dataset.buscar.includes(q);
  }
};

export const nombreDe = (lista, id, campo = "nombre") => {
  if (id == null) {
    return "—";
  }

  const hallado = lista.find((x) => String(x.id) === String(id));

  return hallado ? hallado[campo] : `#${id}`;
};
