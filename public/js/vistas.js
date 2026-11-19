import {
  api,
  catalogo,
  catalogoOpcional,
  invalidar,
  textoError
} from "./api.js";
import {
  h,
  vaciar,
  tabla,
  vacio,
  cargando,
  cabeceraVista,
  boton,
  aviso,
  confirmar,
  modalFormulario,
  insignia,
  siNo,
  fmtFecha,
  fmtHora,
  fmtFechaHora,
  recortar,
  nombreDe
} from "./ui.js";
import { crudVista } from "./crud.js";

const ADMIN = "administrador";
const MEDICO = "medico";
const PACIENTE = "paciente";

const TIPOS_SANGRE = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({
  valor: v,
  etiqueta: v
}));

const opciones = (lista, etiqueta = "nombre") =>
  lista.map((x) => ({ valor: x.id, etiqueta: x[etiqueta] }));

// Los pacientes se muestran con su documento para no confundir homonimos
const opcionesPacientes = (lista) =>
  lista.map((p) => ({ valor: p.id, etiqueta: `${p.nombre} · ${p.documento}` }));

const hoy = () => new Date().toISOString().slice(0, 10);

// Un datetime-local no acepta zona horaria: el maximo es "ahora" local
const ahoraLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

// Catalogos compartidos
const pacientes = () => catalogoOpcional("pacientes", "/api/pacientes");
const medicos = () => catalogoOpcional("medicos", "/api/medicos");
const consultorios = () => catalogoOpcional("consultorios", "/api/consultorios");
const especialidades = () => catalogoOpcional("especialidades", "/api/especialidades");

// =====================================================
// Cuenta de acceso de una ficha (paciente / medico)
//
// Para entrar al sistema, la ficha debe tener una cuenta
// vinculada (usuarioId). El administrador puede crearla
// al guardar la ficha: primero se guarda la ficha y despues
// se crea la cuenta y se vincula, asi un fallo en la cuenta
// no pierde la ficha.
// =====================================================

const cuentaDeAcceso = (rol, nombreFicha, endpoint) => ({
  campos: (fila) =>
    fila?.usuarioId
      ? []
      : [
          {
            nombre: "crearCuenta",
            etiqueta: `Crear una cuenta de acceso para este ${nombreFicha}`,
            tipo: "checkbox",
            ayuda: "Usará el correo de la ficha. Sin una cuenta vinculada no podrá iniciar sesión.",
            ancho: "completo"
          },
          {
            nombre: "passwordCuenta",
            etiqueta: "Contraseña inicial (10 a 72 caracteres)",
            tipo: "password",
            minlength: 10,
            maxlength: 72,
            ancho: "completo"
          }
        ],

  separar: (valores) => {
    const { crearCuenta, passwordCuenta, ...ficha } = valores;

    return { ficha, extra: { crearCuenta, passwordCuenta } };
  },

  alGuardar: async (id, extra, fila, ficha) => {
    if (!extra.crearCuenta) {
      return;
    }

    if (!extra.passwordCuenta) {
      aviso("Se guardó la ficha, pero no se creó la cuenta: falta la contraseña inicial.", "warn", 9000);
      return;
    }

    try {
      const respuesta = await api("POST", "/api/usuarios", {
        nombre: ficha.nombre ?? fila?.nombre,
        email: ficha.email ?? fila?.email ?? fila?.correo,
        password: extra.passwordCuenta,
        rol
      });

      await api("PATCH", `${endpoint}/${id}`, { usuarioId: respuesta.usuario.id });

      aviso("Cuenta de acceso creada y vinculada");
    } catch (error) {
      aviso(`La ficha se guardó, pero no se pudo crear la cuenta: ${textoError(error)}`, "warn", 10000);
    }
  }
});

// =====================================================
// PACIENTES
// =====================================================

const cuentaPaciente = cuentaDeAcceso("paciente", "paciente", "/api/pacientes");

export const pacientesVista = crudVista({
  titulo: "Pacientes",
  subtitulo: "Datos personales y clínicos básicos",
  singular: "paciente",
  plural: "pacientes",
  endpoint: "/api/pacientes",
  claveRespuesta: "paciente",
  separar: cuentaPaciente.separar,
  alGuardar: cuentaPaciente.alGuardar,
  escribe: [ADMIN],
  invalidar: ["pacientes"],
  columnas: () => [
    { titulo: "Nombre", celda: (p) => h("strong", { text: p.nombre }) },
    { titulo: "Documento", celda: (p) => p.documento },
    { titulo: "Correo", celda: (p) => p.correo ?? p.email },
    { titulo: "Teléfono", celda: (p) => p.telefono ?? "—" },
    { titulo: "Sangre", celda: (p) => p.tipoSangre ?? "—" },
    { titulo: "Alergias", celda: (p) => recortar(p.alergias, 40) },
    { titulo: "Cuenta", celda: (p) => (p.usuarioId ? h("span", { class: "badge badge-activo", text: "Vinculada" }) : h("span", { class: "texto-suave", text: "Sin cuenta" })) }
  ],
  campos: (aux, fila) => [
    { nombre: "nombre", etiqueta: "Nombre completo", tipo: "text", requerido: true, minlength: 3, maxlength: 100 },
    { nombre: "documento", etiqueta: "Documento de identidad", tipo: "text", requerido: true },
    { nombre: "email", etiqueta: "Correo electrónico", tipo: "email", requerido: true },
    { nombre: "telefono", etiqueta: "Teléfono", tipo: "text", requerido: true },
    { nombre: "fechaNacimiento", etiqueta: "Fecha de nacimiento", tipo: "date", requerido: true, max: hoy() },
    { nombre: "tipoSangre", etiqueta: "Tipo de sangre", tipo: "select", opciones: TIPOS_SANGRE, anulable: true },
    { nombre: "alergias", etiqueta: "Alergias", tipo: "textarea", anulable: true, maxlength: 500, ancho: "completo", ayuda: "Separe con comas. Se usa para avisar al recetar." },
    ...cuentaPaciente.campos(fila)
  ],
  valoresEdicion: (p) => ({
    nombre: p.nombre,
    documento: p.documento,
    email: p.email ?? p.correo,
    telefono: p.telefono,
    fechaNacimiento: p.fechaNacimiento ? String(p.fechaNacimiento).slice(0, 10) : "",
    tipoSangre: p.tipoSangre,
    alergias: p.alergias
  })
});

// =====================================================
// MEDICOS
// =====================================================

const ESTADOS_MEDICO = [
  { valor: "activo", etiqueta: "Activo" },
  { valor: "inactivo", etiqueta: "Inactivo" },
  { valor: "vacaciones", etiqueta: "Vacaciones" }
];

const cuentaMedico = cuentaDeAcceso("medico", "médico", "/api/medicos");

export const medicosVista = crudVista({
  titulo: "Médicos",
  subtitulo: "Cuerpo médico del hospital",
  singular: "médico",
  plural: "médicos",
  endpoint: "/api/medicos",
  claveRespuesta: "medico",
  separar: cuentaMedico.separar,
  alGuardar: cuentaMedico.alGuardar,
  escribe: [ADMIN],
  invalidar: ["medicos"],
  cargarAux: async () => ({ especialidades: await especialidades() }),
  filtros: [{ clave: "estado", etiqueta: "Estado", opciones: ESTADOS_MEDICO }],
  columnas: () => [
    { titulo: "Nombre", celda: (m) => h("strong", { text: m.nombre }) },
    { titulo: "Documento", celda: (m) => m.documento ?? "—" },
    { titulo: "Especialidad", celda: (m) => m.especialidad ?? "—" },
    { titulo: "Licencia", celda: (m) => m.licenciaMedica ?? m.registroMedico },
    { titulo: "Correo", celda: (m) => m.correo ?? m.email },
    { titulo: "Estado", celda: (m) => insignia(m.estado ?? (m.activo ? "activo" : "inactivo")) },
    { titulo: "Cuenta", celda: (m) => (m.usuarioId ? h("span", { class: "badge badge-activo", text: "Vinculada" }) : h("span", { class: "texto-suave", text: "Sin cuenta" })) }
  ],
  campos: (aux, fila) => [
    { nombre: "nombre", etiqueta: "Nombre completo", tipo: "text", requerido: true, minlength: 3, maxlength: 100 },
    { nombre: "documento", etiqueta: "Documento (6 a 15 dígitos)", tipo: "text", requerido: true, pattern: "[0-9]{6,15}" },
    { nombre: "registroMedico", etiqueta: "Licencia médica", tipo: "text", requerido: true, placeholder: "RM-45871" },
    { nombre: "email", etiqueta: "Correo electrónico", tipo: "email", requerido: true },
    { nombre: "telefono", etiqueta: "Teléfono", tipo: "text", requerido: true },
    {
      nombre: "especialidadId",
      etiqueta: "Especialidad",
      tipo: "select",
      requerido: true,
      opciones: opciones(
        aux.especialidades.filter((e) => e.activa || String(e.id) === String(fila?.especialidadId))
      )
    },
    { nombre: "estado", etiqueta: "Estado", tipo: "select", requerido: true, opciones: ESTADOS_MEDICO, valor: fila ? undefined : "activo" },
    ...cuentaMedico.campos(fila)
  ],
  valoresEdicion: (m) => ({
    nombre: m.nombre,
    documento: m.documento,
    registroMedico: m.registroMedico ?? m.licenciaMedica,
    email: m.email ?? m.correo,
    telefono: m.telefono,
    especialidadId: m.especialidadId,
    estado: m.estado ?? (m.activo ? "activo" : "inactivo")
  })
});

// =====================================================
// ESPECIALIDADES Y CONSULTORIOS
// =====================================================

export const especialidadesVista = crudVista({
  titulo: "Especialidades",
  subtitulo: "Catálogo de especialidades médicas",
  singular: "especialidad",
  plural: "especialidades",
  endpoint: "/api/especialidades",
  escribe: [ADMIN],
  invalidar: ["especialidades"],
  columnas: () => [
    { titulo: "Nombre", celda: (e) => h("strong", { text: e.nombre }) },
    { titulo: "Descripción", celda: (e) => recortar(e.descripcion, 80) },
    { titulo: "Activa", celda: (e) => siNo(e.activa) }
  ],
  campos: () => [
    { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, minlength: 3, maxlength: 100, ancho: "completo" },
    { nombre: "descripcion", etiqueta: "Descripción", tipo: "textarea", ancho: "completo" },
    { nombre: "activa", etiqueta: "Especialidad activa", tipo: "checkbox", porDefecto: true }
  ]
});

export const consultoriosVista = crudVista({
  titulo: "Consultorios",
  subtitulo: "Espacios de atención",
  singular: "consultorio",
  plural: "consultorios",
  endpoint: "/api/consultorios",
  escribe: [ADMIN],
  invalidar: ["consultorios"],
  columnas: () => [
    { titulo: "Código", celda: (c) => h("strong", { text: c.codigo }) },
    { titulo: "Nombre", celda: (c) => c.nombre },
    { titulo: "Piso", celda: (c) => c.piso },
    { titulo: "Ubicación", celda: (c) => c.ubicacion ?? "—" },
    { titulo: "Activo", celda: (c) => siNo(c.activo) }
  ],
  campos: () => [
    { nombre: "codigo", etiqueta: "Código", tipo: "text", requerido: true },
    { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true },
    { nombre: "piso", etiqueta: "Piso", tipo: "number", requerido: true, step: 1 },
    { nombre: "ubicacion", etiqueta: "Ubicación", tipo: "text" },
    { nombre: "activo", etiqueta: "Consultorio activo", tipo: "checkbox", porDefecto: true }
  ]
});

// =====================================================
// CITAS
// =====================================================

const ESTADOS_CITA = [
  { valor: "programada", etiqueta: "Programada" },
  { valor: "confirmada", etiqueta: "Confirmada" },
  { valor: "completada", etiqueta: "Completada" },
  { valor: "cancelada", etiqueta: "Cancelada" }
];

const SIGUIENTES_CITA = {
  programada: [["confirmada", "Confirmar"], ["cancelada", "Cancelar"]],
  confirmada: [["completada", "Completar"], ["cancelada", "Cancelar"]],
  completada: [],
  cancelada: []
};

const columnasCitas = (ctx, aux) => {
  const columnas = [
    { titulo: "Fecha", celda: (c) => fmtFecha(c.fecha) },
    { titulo: "Hora", celda: (c) => fmtHora(c.hora) }
  ];

  if (ctx.rol !== PACIENTE) {
    columnas.push({ titulo: "Paciente", celda: (c) => nombreDe(aux.pacientes, c.pacienteId) });
  }

  columnas.push(
    { titulo: "Médico", celda: (c) => nombreDe(aux.medicos, c.medicoId) },
    { titulo: "Consultorio", celda: (c) => nombreDe(aux.consultorios, c.consultorioId, "codigo") },
    { titulo: "Motivo", celda: (c) => recortar(c.motivo, 50) },
    { titulo: "Estado", celda: (c) => insignia(c.estado) }
  );

  return columnas;
};

const cargarAuxCitas = async () => {
  const [p, m, c] = await Promise.all([pacientes(), medicos(), consultorios()]);
  return { pacientes: p, medicos: m, consultorios: c };
};

export const citasVista = crudVista({
  titulo: "Citas médicas",
  subtitulo: "Agenda general del hospital",
  singular: "cita",
  plural: "citas",
  endpoint: "/api/citas",
  escribe: [ADMIN],
  cargarAux: cargarAuxCitas,
  filtros: [{ clave: "estado", etiqueta: "Estado", opciones: ESTADOS_CITA }],
  columnas: columnasCitas,
  campos: (aux) => [
    { nombre: "pacienteId", etiqueta: "Paciente", tipo: "select", requerido: true, opciones: opcionesPacientes(aux.pacientes) },
    {
      nombre: "medicoId",
      etiqueta: "Médico",
      tipo: "select",
      requerido: true,
      opciones: aux.medicos
        .filter((m) => (m.estado ?? "activo") === "activo")
        .map((m) => ({ valor: m.id, etiqueta: `${m.nombre} · ${m.especialidad ?? ""}` }))
    },
    { nombre: "consultorioId", etiqueta: "Consultorio", tipo: "select", requerido: true, opciones: aux.consultorios.filter((c) => c.activo).map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.nombre}` })) },
    { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true },
    { nombre: "hora", etiqueta: "Hora", tipo: "time", requerido: true },
    { nombre: "motivo", etiqueta: "Motivo", tipo: "text", requerido: true, minlength: 5, maxlength: 300 }
  ],
  acciones: (fila, ctx, aux, alCambiar) =>
    (SIGUIENTES_CITA[fila.estado] ?? []).map(([estado, texto]) =>
      boton(
        texto,
        async () => {
          try {
            await api("PATCH", `/api/citas/${fila.id}/estado`, { estado });
            aviso(`Cita ${estado}`);
            alCambiar();
          } catch (error) {
            aviso(textoError(error), "error", 7000);
          }
        },
        "btn-ghost btn-sm"
      )
    )
});

export const misCitasVista = crudVista({
  titulo: "Mis citas",
  subtitulo: "Sus citas médicas",
  singular: "cita",
  plural: "citas",
  listar: "/api/citas/mis-citas",
  endpoint: "/api/citas",
  escribe: [],
  cargarAux: cargarAuxCitas,
  filtros: [{ clave: "estado", etiqueta: "Estado", opciones: ESTADOS_CITA }],
  columnas: columnasCitas
});

// =====================================================
// HABITACIONES
// =====================================================

const TIPOS_HABITACION = ["UCI", "General", "Aislamiento"].map((v) => ({ valor: v, etiqueta: v }));

const ESTADOS_HABITACION = [
  { valor: "disponible", etiqueta: "Disponible" },
  { valor: "ocupada", etiqueta: "Ocupada" },
  { valor: "mantenimiento", etiqueta: "Mantenimiento" }
];

export const habitacionesVista = crudVista({
  titulo: "Habitaciones",
  subtitulo: "Ocupación y disponibilidad",
  singular: "habitación",
  plural: "habitaciones",
  endpoint: "/api/habitaciones",
  metodoEditar: "PUT",
  eliminar: false,
  escribe: [ADMIN],
  invalidar: ["habitaciones"],
  filtros: [
    { clave: "estado", etiqueta: "Estado", opciones: ESTADOS_HABITACION },
    { clave: "tipo", etiqueta: "Tipo", opciones: TIPOS_HABITACION }
  ],
  columnas: () => [
    { titulo: "Número", celda: (x) => h("strong", { text: x.numero }) },
    { titulo: "Piso", celda: (x) => x.piso },
    { titulo: "Tipo", celda: (x) => x.tipo },
    { titulo: "Estado", celda: (x) => insignia(x.estado) }
  ],
  campos: (aux, fila) => [
    { nombre: "numero", etiqueta: "Número", tipo: "text", requerido: true, maxlength: 10, pattern: "[A-Za-z0-9\\-]{1,10}" },
    { nombre: "piso", etiqueta: "Piso", tipo: "number", requerido: true, min: -5, max: 100, step: 1 },
    { nombre: "tipo", etiqueta: "Tipo", tipo: "select", requerido: true, opciones: TIPOS_HABITACION },
    fila?.estado === "ocupada"
      ? {
          nombre: "estado",
          etiqueta: "Estado",
          tipo: "select",
          requerido: true,
          opciones: [{ valor: "ocupada", etiqueta: "Ocupada (hay un ingreso activo)" }],
          ayuda: "Se libera dando el alta al paciente."
        }
      : {
          nombre: "estado",
          etiqueta: "Estado",
          tipo: "select",
          requerido: true,
          valor: fila ? undefined : "disponible",
          opciones: ESTADOS_HABITACION.filter((e) => e.valor !== "ocupada"),
          ayuda: "«Ocupada» la asigna el sistema al registrar un ingreso."
        }
  ]
});

// =====================================================
// INGRESOS
// =====================================================

export const ingresosVista = async (ctx) => {
  let filtro = "";
  const zona = h("div", {}, cargando());

  const cargar = async () => {
    vaciar(zona).append(cargando());

    try {
      const ruta = filtro === "" ? "/api/ingresos" : `/api/ingresos?activo=${filtro}`;
      const [ingresos, listaPacientes, habitaciones] = await Promise.all([
        api("GET", ruta),
        pacientes(),
        api("GET", "/api/habitaciones")
      ]);

      vaciar(zona);

      if (ingresos.length === 0) {
        zona.append(vacio("No hay ingresos", "Use «Registrar ingreso» para hospitalizar a un paciente."));
        return;
      }

      zona.append(
        tabla(
          [
            { titulo: "Paciente", celda: (i) => h("strong", { text: nombreDe(listaPacientes, i.pacienteId) }) },
            { titulo: "Habitación", celda: (i) => nombreDe(habitaciones, i.habitacionId, "numero") },
            { titulo: "Diagnóstico", celda: (i) => recortar(i.diagnostico, 60) },
            { titulo: "Ingreso", celda: (i) => fmtFechaHora(i.fechaIngreso) },
            { titulo: "Alta", celda: (i) => (i.fechaAlta ? fmtFechaHora(i.fechaAlta) : insignia("enCurso")) },
            { titulo: "Registró", celda: (i) => (i.registradoPor ? `Usuario ${i.registradoPor}` : "—") }
          ],
          ingresos,
          {
            acciones: (i) =>
              i.fechaAlta ? [] : [boton("Dar de alta", () => abrirAlta(i), "btn-ghost btn-sm")]
          }
        )
      );
    } catch (error) {
      vaciar(zona).append(vacio("No se pudieron cargar los ingresos", textoError(error)));
    }
  };

  const abrirAlta = (ingreso) =>
    modalFormulario({
      titulo: "Dar de alta al paciente",
      textoEnviar: "Registrar alta",
      ancho: "sm",
      campos: [
        {
          nombre: "fechaAlta",
          etiqueta: "Fecha y hora del alta",
          tipo: "datetime-local",
          max: ahoraLocal(),
          ayuda: "Opcional: si la deja vacía se usa el momento actual. No puede ser anterior al ingreso.",
          ancho: "completo"
        }
      ],
      enviar: async (valores) => {
        await api("PATCH", `/api/ingresos/${ingreso.id}/dar-alta`, valores);
        aviso("Alta registrada: la habitación quedó disponible");
        invalidar("habitaciones");
        cargar();
      }
    });

  const abrirIngreso = async () => {
    let disponibles;
    let lista;

    try {
      [disponibles, lista] = await Promise.all([api("GET", "/api/habitaciones/disponibles"), pacientes()]);
    } catch (error) {
      aviso(textoError(error), "error");
      return;
    }

    if (disponibles.length === 0) {
      aviso("No hay habitaciones disponibles en este momento", "warn");
      return;
    }

    modalFormulario({
      titulo: "Registrar ingreso",
      textoEnviar: "Registrar ingreso",
      campos: [
        { nombre: "pacienteId", etiqueta: "Paciente", tipo: "select", requerido: true, opciones: opcionesPacientes(lista) },
        {
          nombre: "habitacionId",
          etiqueta: "Habitación disponible",
          tipo: "select",
          requerido: true,
          opciones: disponibles.map((x) => ({ valor: x.id, etiqueta: `${x.numero} · piso ${x.piso} · ${x.tipo}` }))
        },
        { nombre: "diagnostico", etiqueta: "Diagnóstico", tipo: "textarea", requerido: true, minlength: 3, maxlength: 500, ancho: "completo" },
        { nombre: "fechaIngreso", etiqueta: "Fecha y hora de ingreso", tipo: "datetime-local", max: ahoraLocal(), ayuda: "Opcional: por defecto, ahora.", ancho: "completo" }
      ],
      enviar: async (valores) => {
        await api("POST", "/api/ingresos", valores);
        aviso("Ingreso registrado: la habitación quedó ocupada");
        invalidar("habitaciones");
        cargar();
      }
    });
  };

  const selector = h(
    "select",
    {
      "aria-label": "Filtrar ingresos",
      onchange: (e) => {
        filtro = e.target.value;
        cargar();
      }
    },
    h("option", { value: "", text: "Todos los ingresos" }),
    h("option", { value: "true", text: "Hospitalizados (sin alta)" }),
    h("option", { value: "false", text: "Con alta" })
  );

  cargar();

  return h(
    "section",
    {},
    cabeceraVista("Ingresos", "Hospitalizaciones y altas", boton("Registrar ingreso", abrirIngreso, "btn-primary")),
    h("div", { class: "barra-herramientas" }, selector),
    zona
  );
};

// =====================================================
// Piezas de historial y recetas
// =====================================================

const dato = (etiqueta, valor) =>
  valor
    ? h("div", { class: "dato" }, h("span", { class: "etq", text: etiqueta }), h("span", { class: "val", text: valor }))
    : null;

const selectorPaciente = (lista, alCambiar, valorInicial = "") => {
  const select = h(
    "select",
    { "aria-label": "Filtrar por paciente", onchange: (e) => alCambiar(e.target.value) },
    h("option", { value: "", text: "Todos los pacientes" }),
    lista.map((p) => h("option", { value: String(p.id), text: `${p.nombre} · ${p.documento}` }))
  );

  select.value = String(valorInicial);

  return select;
};

// ---------- Repetidor de medicamentos ----------

const repetidorMedicamentos = () => {
  const filas = [];
  const contenedor = h("div", { class: "repetidor" });
  const botonAgregar = boton("+ Agregar medicamento", () => agregar(), "btn-ghost btn-sm");

  const refrescar = () => {
    filas.forEach((fila, indice) => {
      fila.titulo.textContent = `Medicamento ${indice + 1}`;
      fila.quitar.hidden = filas.length === 1;
    });

    botonAgregar.disabled = filas.length >= 20;
  };

  const input = (clase, etiqueta, atributos, ancho) =>
    h(
      "div",
      { class: `campo${ancho ? " campo-ancho" : ""}` },
      h("label", {}, etiqueta, atributos.required ? h("span", { class: "obligatorio" }, " *") : null),
      h("input", { class: clase, type: "text", autocomplete: "off", ...atributos })
    );

  const agregar = () => {
    if (filas.length >= 20) {
      return;
    }

    const titulo = h("span");
    const quitar = boton("Quitar", () => {
      filas.splice(filas.indexOf(fila), 1);
      el.remove();
      refrescar();
    }, "btn-ghost btn-sm");

    const el = h(
      "div",
      { class: "med-fila" },
      h("div", { class: "med-cabecera" }, titulo, quitar),
      h(
        "div",
        { class: "rejilla-campos" },
        input("m-nombre", "Medicamento", { required: true, minlength: 2, maxlength: 100 }, true),
        input("m-dosis", "Dosis", { required: true, maxlength: 50, placeholder: "500 mg" }),
        input("m-frecuencia", "Frecuencia", { required: true, maxlength: 50, placeholder: "Cada 8 horas" }),
        h(
          "div",
          { class: "campo" },
          h("label", {}, "Días", h("span", { class: "obligatorio" }, " *")),
          h("input", { class: "m-dias", type: "number", required: true, min: 1, max: 365, step: 1, value: 7 })
        ),
        input("m-instr", "Instrucciones (opcional)", { maxlength: 300, placeholder: "Tomar con alimentos" }, true)
      )
    );

    const fila = { el, titulo, quitar };
    filas.push(fila);
    contenedor.append(el);
    refrescar();
  };

  agregar();

  return {
    el: h(
      "div",
      { class: "campo campo-ancho" },
      h("label", {}, "Medicamentos ", h("span", { class: "obligatorio" }, "*")),
      contenedor,
      h("div", {}, botonAgregar)
    ),
    leer: () =>
      filas.map(({ el }) => {
        const medicamento = {
          medicamento: el.querySelector(".m-nombre").value.trim(),
          dosis: el.querySelector(".m-dosis").value.trim(),
          frecuencia: el.querySelector(".m-frecuencia").value.trim(),
          duracionDias: Number(el.querySelector(".m-dias").value)
        };

        const instrucciones = el.querySelector(".m-instr").value.trim();

        if (instrucciones !== "") {
          medicamento.instrucciones = instrucciones;
        }

        return medicamento;
      })
  };
};

// ---------- Formulario de receta ----------

const abrirFormularioReceta = async (ctx, { pacienteId = "", historialId = "", alGuardar }) => {
  const [listaPacientes, listaMedicos] = await Promise.all([pacientes(), medicos()]);
  const repetidor = repetidorMedicamentos();

  const campos = [
    { nombre: "pacienteId", etiqueta: "Paciente", tipo: "select", requerido: true, opciones: opcionesPacientes(listaPacientes), valor: pacienteId }
  ];

  if (ctx.rol === ADMIN) {
    campos.push({
      nombre: "medicoId",
      etiqueta: "Médico que emite",
      tipo: "select",
      requerido: true,
      opciones: listaMedicos
        .filter((m) => (m.estado ?? "activo") === "activo")
        .map((m) => ({ valor: m.id, etiqueta: m.nombre }))
    });
  }

  campos.push(
    { nombre: "historialId", etiqueta: "Atención del historial (opcional)", tipo: "select", opciones: [], ancho: ctx.rol === ADMIN ? undefined : "completo" },
    { nombre: "indicaciones", etiqueta: "Indicaciones generales", tipo: "textarea", maxlength: 500, anulable: true, ancho: "completo" }
  );

  const { formulario } = modalFormulario({
    titulo: "Emitir receta médica",
    textoEnviar: "Emitir receta",
    ancho: "lg",
    campos,
    extra: repetidor.el,
    leerExtra: () => ({ medicamentos: repetidor.leer() }),
    enviar: async (valores) => {
      const respuesta = await api("POST", "/api/recetas", valores);

      aviso("Receta emitida correctamente");

      if (respuesta.advertencias?.length) {
        aviso(`Atención: ${respuesta.advertencias.join(" · ")}`, "warn", 15000);
      }

      alGuardar?.();
    }
  });

  // El campo "historial" depende del paciente elegido
  const selPaciente = formulario.controles.get("pacienteId").control;
  const selHistorial = formulario.controles.get("historialId").control;

  const cargarHistorial = async () => {
    selHistorial.replaceChildren(h("option", { value: "", text: "— Ninguna —" }));

    if (selPaciente.value === "") {
      return;
    }

    try {
      const entradas = await api("GET", `/api/historial?pacienteId=${selPaciente.value}`);

      for (const e of entradas) {
        selHistorial.append(h("option", { value: String(e.id), text: `${fmtFecha(e.fecha)} · ${recortar(e.motivoConsulta, 40)}` }));
      }

      selHistorial.value = historialId ? String(historialId) : "";
    } catch {
      /* sin permiso o sin datos: queda "Ninguna" */
    }
  };

  selPaciente.addEventListener("change", () => {
    historialId = "";
    cargarHistorial();
  });

  cargarHistorial();
};

// =====================================================
// HISTORIAL MEDICO
// =====================================================

export const historialVista = async (ctx) => {
  const esPaciente = ctx.rol === PACIENTE;
  const [listaPacientes, listaMedicos] = await Promise.all([pacientes(), medicos()]);

  let pacienteFiltro = "";
  const zona = h("div", {}, cargando());

  const cargar = async () => {
    vaciar(zona).append(cargando());

    try {
      const ruta = esPaciente
        ? "/api/historial/mi-historial"
        : pacienteFiltro === ""
          ? "/api/historial"
          : `/api/historial?pacienteId=${pacienteFiltro}`;

      const entradas = await api("GET", ruta);

      vaciar(zona);

      if (entradas.length === 0) {
        zona.append(vacio("Sin registros en el historial", esPaciente ? undefined : "Use «Nueva entrada» para agregar una atención."));
        return;
      }

      zona.append(
        h(
          "div",
          { class: "lista-tarjetas" },
          entradas.map((e) =>
            h(
              "article",
              { class: "tarjeta entrada" },
              h(
                "div",
                { class: "entrada-cabecera" },
                h("span", { class: "fecha", text: fmtFechaHora(e.fecha) }),
                h("span", { class: "texto-suave", text: `Dr(a). ${nombreDe(listaMedicos, e.medicoId)}` })
              ),
              esPaciente ? null : dato("Paciente", nombreDe(listaPacientes, e.pacienteId)),
              dato("Motivo de consulta", e.motivoConsulta),
              dato("Diagnóstico", e.diagnostico),
              dato("Tratamiento", e.tratamiento),
              dato("Observaciones", e.observaciones),
              esPaciente
                ? null
                : h(
                    "div",
                    { class: "entrada-pie" },
                    boton(
                      "Emitir receta",
                      () => abrirFormularioReceta(ctx, { pacienteId: e.pacienteId, historialId: e.id, alGuardar: () => ctx.navegar("recetas") }),
                      "btn-ghost btn-sm"
                    )
                  )
            )
          )
        )
      );
    } catch (error) {
      vaciar(zona).append(vacio("No se pudo cargar el historial", textoError(error)));
    }
  };

  const abrirNueva = async () => {
    const campos = [
      { nombre: "pacienteId", etiqueta: "Paciente", tipo: "select", requerido: true, opciones: opcionesPacientes(listaPacientes), valor: pacienteFiltro }
    ];

    if (ctx.rol === ADMIN) {
      campos.push({
        nombre: "medicoId",
        etiqueta: "Médico que atiende",
        tipo: "select",
        requerido: true,
        opciones: listaMedicos.filter((m) => (m.estado ?? "activo") === "activo").map((m) => ({ valor: m.id, etiqueta: m.nombre }))
      });
    }

    campos.push(
      { nombre: "citaId", etiqueta: "Cita asociada (opcional)", tipo: "select", opciones: [], ancho: ctx.rol === ADMIN ? undefined : "completo" },
      { nombre: "motivoConsulta", etiqueta: "Motivo de consulta", tipo: "text", requerido: true, minlength: 3, maxlength: 300, ancho: "completo" },
      { nombre: "diagnostico", etiqueta: "Diagnóstico", tipo: "textarea", requerido: true, minlength: 3, maxlength: 500, ancho: "completo" },
      { nombre: "tratamiento", etiqueta: "Tratamiento", tipo: "textarea", maxlength: 1000, anulable: true, ancho: "completo" },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "textarea", maxlength: 1000, anulable: true, ancho: "completo" }
    );

    const { formulario } = modalFormulario({
      titulo: "Nueva entrada de historial",
      textoEnviar: "Agregar al historial",
      ancho: "lg",
      campos,
      enviar: async (valores) => {
        await api("POST", "/api/historial", valores);
        aviso("Entrada agregada al historial");
        cargar();
      }
    });

    formulario.el.prepend(
      h("p", { class: "texto-suave", text: "El historial solo se agrega: una vez guardada, la entrada no se puede editar ni borrar." })
    );

    // Las citas ofrecidas dependen del paciente elegido
    const selPaciente = formulario.controles.get("pacienteId").control;
    const selCita = formulario.controles.get("citaId").control;

    const cargarCitas = async () => {
      selCita.replaceChildren(h("option", { value: "", text: "— Ninguna —" }));

      if (selPaciente.value === "") {
        return;
      }

      try {
        const citas =
          ctx.rol === ADMIN
            ? await api("GET", `/api/citas/paciente/${selPaciente.value}`)
            : (await api("GET", "/api/citas/mis-citas")).filter((c) => String(c.pacienteId) === selPaciente.value);

        for (const c of citas) {
          selCita.append(h("option", { value: String(c.id), text: `${fmtFecha(c.fecha)} ${fmtHora(c.hora)} · ${recortar(c.motivo, 35)}` }));
        }
      } catch {
        /* sin permiso o sin citas */
      }
    };

    selPaciente.addEventListener("change", cargarCitas);
    cargarCitas();
  };

  cargar();

  return h(
    "section",
    {},
    cabeceraVista(
      esPaciente ? "Mi historial médico" : "Historial médico",
      esPaciente ? "Sus atenciones registradas" : "Atenciones registradas por paciente",
      esPaciente ? null : boton("Nueva entrada", abrirNueva, "btn-primary")
    ),
    esPaciente
      ? null
      : h(
          "div",
          { class: "barra-herramientas" },
          selectorPaciente(listaPacientes, (valor) => {
            pacienteFiltro = valor;
            cargar();
          })
        ),
    zona
  );
};

// =====================================================
// RECETAS
// =====================================================

export const recetasVista = async (ctx) => {
  const esPaciente = ctx.rol === PACIENTE;
  const [listaPacientes, listaMedicos] = await Promise.all([pacientes(), medicos()]);

  let pacienteFiltro = "";
  let estadoFiltro = "";
  const zona = h("div", {}, cargando());

  const cambiarEstado = async (receta, estado) => {
    const si = await confirmar({
      titulo: estado === "dispensada" ? "Dispensar receta" : "Anular receta",
      mensaje:
        estado === "dispensada"
          ? "¿Marcar esta receta como dispensada? No podrá cambiarse después."
          : "¿Anular esta receta? No podrá cambiarse después.",
      textoOk: estado === "dispensada" ? "Dispensar" : "Anular",
      peligro: estado === "anulada"
    });

    if (!si) {
      return;
    }

    try {
      await api("PATCH", `/api/recetas/${receta.id}/estado`, { estado });
      aviso(`Receta ${estado}`);
      cargar();
    } catch (error) {
      aviso(textoError(error), "error", 7000);
    }
  };

  const cargar = async () => {
    vaciar(zona).append(cargando());

    try {
      let ruta = "/api/recetas/mis-recetas";

      if (!esPaciente) {
        const filtros = new URLSearchParams();

        if (pacienteFiltro) {
          filtros.set("pacienteId", pacienteFiltro);
        }

        if (estadoFiltro) {
          filtros.set("estado", estadoFiltro);
        }

        ruta = `/api/recetas${filtros.size ? `?${filtros}` : ""}`;
      }

      const recetas = await api("GET", ruta);

      vaciar(zona);

      if (recetas.length === 0) {
        zona.append(vacio("No hay recetas", esPaciente ? undefined : "Use «Nueva receta» para emitir la primera."));
        return;
      }

      zona.append(
        h(
          "div",
          { class: "lista-tarjetas" },
          recetas.map((r) =>
            h(
              "article",
              { class: "tarjeta entrada" },
              h(
                "div",
                { class: "entrada-cabecera" },
                h("span", { class: "fecha", text: `Receta #${r.id} · ${fmtFechaHora(r.fecha)}` }),
                insignia(r.estado)
              ),
              h(
                "div",
                { class: "texto-suave", text: `${esPaciente ? "" : `${nombreDe(listaPacientes, r.pacienteId)} · `}Dr(a). ${nombreDe(listaMedicos, r.medicoId)}` }
              ),
              dato("Indicaciones", r.indicaciones),
              h(
                "table",
                { class: "meds" },
                h(
                  "thead",
                  {},
                  h("tr", {}, ["Medicamento", "Dosis", "Frecuencia", "Días", "Instrucciones"].map((t) => h("th", { text: t })))
                ),
                h(
                  "tbody",
                  {},
                  r.medicamentos.map((m) =>
                    h(
                      "tr",
                      {},
                      h("td", {}, h("strong", { text: m.medicamento })),
                      h("td", { text: m.dosis }),
                      h("td", { text: m.frecuencia }),
                      h("td", { text: String(m.duracionDias) }),
                      h("td", { text: m.instrucciones ?? "—" })
                    )
                  )
                )
              ),
              !esPaciente && r.estado === "activa"
                ? h(
                    "div",
                    { class: "entrada-pie" },
                    boton("Dispensar", () => cambiarEstado(r, "dispensada"), "btn-ghost btn-sm"),
                    boton("Anular", () => cambiarEstado(r, "anulada"), "btn-ghost btn-sm")
                  )
                : null
            )
          )
        )
      );
    } catch (error) {
      vaciar(zona).append(vacio("No se pudieron cargar las recetas", textoError(error)));
    }
  };

  cargar();

  const herramientas = esPaciente
    ? null
    : h(
        "div",
        { class: "barra-herramientas" },
        selectorPaciente(listaPacientes, (valor) => {
          pacienteFiltro = valor;
          cargar();
        }),
        h(
          "select",
          {
            "aria-label": "Filtrar por estado",
            onchange: (e) => {
              estadoFiltro = e.target.value;
              cargar();
            }
          },
          h("option", { value: "", text: "Estado: todos" }),
          h("option", { value: "activa", text: "Activas" }),
          h("option", { value: "dispensada", text: "Dispensadas" }),
          h("option", { value: "anulada", text: "Anuladas" })
        )
      );

  return h(
    "section",
    {},
    cabeceraVista(
      esPaciente ? "Mis recetas" : "Recetas médicas",
      esPaciente ? "Sus recetas y medicamentos" : "Emisión y control de recetas",
      esPaciente ? null : boton("Nueva receta", () => abrirFormularioReceta(ctx, { pacienteId: pacienteFiltro, alGuardar: cargar }), "btn-primary")
    ),
    herramientas,
    zona
  );
};

// =====================================================
// INICIO
// =====================================================

export const inicioVista = async (ctx) => {
  const definiciones = {
    [ADMIN]: [
      ["Pacientes", "/api/pacientes", "#/pacientes"],
      ["Médicos", "/api/medicos", "#/medicos"],
      ["Citas", "/api/citas", "#/citas"],
      ["Habitaciones disponibles", "/api/habitaciones/disponibles", "#/habitaciones"],
      ["Hospitalizados", "/api/ingresos?activo=true", "#/ingresos"],
      ["Recetas activas", "/api/recetas?estado=activa", "#/recetas"]
    ],
    [MEDICO]: [
      ["Pacientes", "/api/pacientes", "#/pacientes"],
      ["Mis citas", "/api/citas/mis-citas", "#/mis-citas"],
      ["Habitaciones disponibles", "/api/habitaciones/disponibles", "#/habitaciones"],
      ["Hospitalizados", "/api/ingresos?activo=true", "#/ingresos"],
      ["Recetas activas", "/api/recetas?estado=activa", "#/recetas"]
    ],
    [PACIENTE]: [
      ["Mis citas", "/api/citas/mis-citas", "#/mis-citas"],
      ["Entradas en mi historial", "/api/historial/mi-historial", "#/mi-historial"],
      ["Mis recetas", "/api/recetas/mis-recetas", "#/mis-recetas"]
    ]
  };

  const tarjetas = (definiciones[ctx.rol] ?? []).map(([titulo, ruta, destino]) => {
    const numero = h("span", { class: "numero", text: "…" });

    api("GET", ruta)
      .then((lista) => {
        numero.textContent = String(lista.length);
      })
      .catch(() => {
        numero.textContent = "—";
      });

    return h("a", { class: "tarjeta resumen", href: destino }, numero, h("span", { class: "etiqueta", text: titulo }));
  });

  return h(
    "section",
    {},
    cabeceraVista(`Bienvenido(a), ${ctx.usuario.nombre}`, "Resumen de su actividad"),
    h("div", { class: "rejilla-resumen" }, tarjetas),
    ctx.rol === PACIENTE
      ? h("p", { class: "texto-suave", text: "Desde el menú puede consultar sus citas, su historial médico y sus recetas." })
      : null
  );
};
