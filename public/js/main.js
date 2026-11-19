import { api, sesion, invalidarTodo, textoError } from "./api.js";
import { h, vaciar, cargando, aviso, panelError, boton, formulario } from "./ui.js";
import {
  inicioVista,
  pacientesVista,
  medicosVista,
  especialidadesVista,
  consultoriosVista,
  citasVista,
  misCitasVista,
  habitacionesVista,
  ingresosVista,
  historialVista,
  recetasVista
} from "./vistas.js";

const raiz = document.getElementById("app");

const ADMIN = "administrador";
const MEDICO = "medico";
const PACIENTE = "paciente";

// ========================================
// Secciones del menu y quien las ve
// ========================================

const RUTAS = [
  { ruta: "inicio", titulo: "Inicio", icono: "🏠", roles: [ADMIN, MEDICO, PACIENTE], vista: inicioVista },
  { ruta: "pacientes", titulo: "Pacientes", icono: "👤", roles: [ADMIN, MEDICO], vista: pacientesVista },
  { ruta: "medicos", titulo: "Médicos", icono: "🩺", roles: [ADMIN, MEDICO, PACIENTE], vista: medicosVista },
  { ruta: "especialidades", titulo: "Especialidades", icono: "🎓", roles: [ADMIN], vista: especialidadesVista },
  { ruta: "consultorios", titulo: "Consultorios", icono: "🏢", roles: [ADMIN], vista: consultoriosVista },
  { ruta: "citas", titulo: "Citas", icono: "🗓️", roles: [ADMIN], vista: citasVista },
  { ruta: "mis-citas", titulo: "Mis citas", icono: "🗓️", roles: [MEDICO, PACIENTE], vista: misCitasVista },
  { ruta: "habitaciones", titulo: "Habitaciones", icono: "🛏️", roles: [ADMIN, MEDICO], vista: habitacionesVista },
  { ruta: "ingresos", titulo: "Ingresos", icono: "🏥", roles: [ADMIN, MEDICO], vista: ingresosVista },
  { ruta: "historial", titulo: "Historial médico", icono: "📋", roles: [ADMIN, MEDICO], vista: historialVista },
  { ruta: "mi-historial", titulo: "Mi historial", icono: "📋", roles: [PACIENTE], vista: historialVista },
  { ruta: "recetas", titulo: "Recetas", icono: "💊", roles: [ADMIN, MEDICO], vista: recetasVista },
  { ruta: "mis-recetas", titulo: "Mis recetas", icono: "💊", roles: [PACIENTE], vista: recetasVista }
];

// ========================================
// Logo (SVG construido con DOM, sin HTML)
// ========================================

const logo = () => {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");

  const cruz = document.createElementNS(ns, "path");
  cruz.setAttribute("d", "M13 5h6v8h8v6h-8v8h-6v-8H5v-6h8z");
  cruz.setAttribute("fill", "#ffffff");
  svg.append(cruz);

  return h("div", { class: "logo-cruz" }, svg);
};

// ========================================
// Inicio de sesion
// ========================================

const pintarLogin = () => {
  document.title = "Iniciar sesión · Hospital";

  const f = formulario(
    [
      { nombre: "email", etiqueta: "Correo electrónico", tipo: "email", requerido: true, ancho: "completo" },
      { nombre: "password", etiqueta: "Contraseña", tipo: "password", requerido: true, ancho: "completo" }
    ],
    {}
  );

  const enviar = h("button", { class: "btn btn-primary", type: "submit", text: "Ingresar" });

  f.el.append(enviar);

  f.el.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    f.limpiarError();

    if (!f.el.reportValidity()) {
      return;
    }

    const { email, password } = f.leer();

    enviar.disabled = true;
    enviar.textContent = "Ingresando…";

    try {
      const respuesta = await api("POST", "/api/auth/login", { email, password }, { sinToken: true });

      sesion.iniciar(respuesta.token, respuesta.usuario);
      location.hash = "#/inicio";
      pintarApp();
    } catch (error) {
      f.mostrarError(error);
      enviar.disabled = false;
      enviar.textContent = "Ingresar";
    }
  });

  vaciar(raiz).append(
    h(
      "div",
      { class: "login" },
      h(
        "div",
        { class: "login-marca" },
        logo(),
        h("h1", { text: "Gestión clínica hospitalaria" }),
        h("p", { text: "Pacientes, citas, habitaciones, hospitalizaciones, historial médico y recetas en un solo lugar." }),
        h("ul", {}, h("li", { text: "Acceso según su rol" }), h("li", { text: "Historial con trazabilidad" }), h("li", { text: "Recetas con aviso de alergias" }))
      ),
      h(
        "div",
        { class: "login-panel" },
        h(
          "div",
          { class: "login-tarjeta" },
          h("div", {}, h("h2", { text: "Iniciar sesión" }), h("p", { class: "texto-suave", text: "Ingrese con su cuenta del hospital." })),
          f.el
        )
      )
    )
  );

  f.controles.get("email").control.focus();
};

// ========================================
// Aplicacion (con sesion iniciada)
// ========================================

let version = 0;

const pintarApp = () => {
  const usuario = sesion.usuario;
  const rol = usuario.rol;
  const permitidas = RUTAS.filter((r) => r.roles.includes(rol));

  const enlaces = permitidas.map((r) =>
    h("a", { href: `#/${r.ruta}`, dataset: { ruta: r.ruta } }, h("span", { class: "icono", "aria-hidden": "true", text: r.icono }), r.titulo)
  );

  const menu = h(
    "nav",
    { class: "menu", "aria-label": "Menú principal" },
    h("div", { class: "menu-marca" }, logo(), "Hospital"),
    enlaces,
    h(
      "div",
      { class: "menu-pie" },
      h("strong", { text: usuario.nombre }),
      h("span", { class: "rol", text: rol === MEDICO ? "Médico" : rol === ADMIN ? "Administrador" : "Paciente" }),
      boton("Cerrar sesión", cerrarSesion, "btn")
    )
  );

  const principal = h("main", { class: "principal", id: "contenido", tabindex: "-1" });

  const barraMovil = h(
    "header",
    { class: "barra-movil" },
    h("strong", { text: "Hospital" }),
    boton("☰ Menú", () => menu.classList.toggle("abierto"), "btn btn-sm", { "aria-label": "Abrir menú" })
  );

  vaciar(raiz).append(h("div", { class: "estructura" }, menu, h("div", {}, barraMovil, principal)));

  const ctx = {
    rol,
    usuario,
    recargar: () => renderizar(),
    navegar: (ruta) => {
      location.hash = `#/${ruta}`;
    }
  };

  const renderizar = async () => {
    const actual = location.hash.replace(/^#\//, "") || "inicio";
    const entrada = permitidas.find((r) => r.ruta === actual);

    if (!entrada) {
      location.hash = "#/inicio";
      return;
    }

    const miVersion = ++version;

    document.title = `${entrada.titulo} · Hospital`;
    menu.classList.remove("abierto");

    for (const a of enlaces) {
      if (a.dataset.ruta === entrada.ruta) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    }

    vaciar(principal).append(cargando());

    try {
      const nodo = await entrada.vista(ctx);

      // Si la persona navego a otra seccion mientras cargaba, se descarta
      if (miVersion === version) {
        vaciar(principal).append(nodo);
      }
    } catch (error) {
      if (miVersion === version) {
        vaciar(principal).append(panelError(textoError(error), renderizar));
      }
    }
  };

  window.onhashchange = renderizar;
  renderizar();
};

// ========================================
// Cerrar sesion
// ========================================

const cerrarSesion = () => {
  sesion.cerrar();
  invalidarTodo();
  window.onhashchange = null;
  location.hash = "";
  pintarLogin();
};

window.addEventListener("sesion-expirada", () => {
  if (!sesion.token) {
    return;
  }

  cerrarSesion();
  aviso("Su sesión expiró o fue cerrada. Inicie sesión de nuevo.", "warn", 8000);
});

// ========================================
// Arranque
// ========================================

if (sesion.token && sesion.usuario) {
  pintarApp();
} else {
  pintarLogin();
}
