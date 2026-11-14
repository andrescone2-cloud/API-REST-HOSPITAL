# Laboratorio No. 10 — API_HOSPITAL

BLOQUE 6 — Autorización: RBAC, IDOR/BOLA y control de acceso a recursos.
Fecha: 10 de octubre de 2026.

Hasta el Lab 9 la API sabía **quién** era cada quien. En este laboratorio
aprende **qué puede hacer** y **sobre qué datos**.

---

# De dónde partíamos

Al cerrar el Lab 9 teníamos tres preguntas resueltas y una abierta:

    X-API-Key  ->  ¿qué aplicación consume la API?        resuelto
    JWT        ->  ¿qué usuario está autenticado?         resuelto
    rol        ->  ¿qué puede hacer?                      SIN USAR
    objeto     ->  ¿sobre qué datos concretos?            SIN RESOLVER

El rol viajaba dentro del token y llegaba al servidor en `req.usuario.rol`, pero
no cambiaba absolutamente nada: un `paciente` autenticado llamaba a los mismos
endpoints que un `administrador`. Lo dejamos escrito como la primera limitación
del informe anterior.

Este laboratorio cierra las dos últimas.

## 401 y 403 otra vez, ahora con un matiz nuevo

    401 Unauthorized  ->  no existe una autenticación válida
    403 Forbidden     ->  sé quién eres, pero no tienes permiso

La novedad del Lab 10 es que ahora hay **dos motivos distintos** para un 403:

- Tu **rol** no puede hacer esta operación (RBAC).
- Tu rol sí puede, pero **ese recurso no es tuyo** (BOLA).

[Captura: el diagrama de capas del PDF, de REQUEST a INTEGRIDAD REFERENCIAL]

---

# Cómo se trabajó

El profesor entregó `insumo_lab_10_hospital.zip`, que es su `src/` de referencia
con el Lab 10 ya aplicado. En lugar de copiarlo encima sin mirar, se comparó
archivo por archivo contra el proyecto para saber exactamente qué cambia.

    insumo: 47 archivos .js   |   proyecto antes: 42

    archivos nuevos en el insumo ..... 5
    archivos que difieren ........... 32
    de esos, solo formato ............ 8
    diferencias reales de código .... 24
    archivos del proyecto que faltan en el insumo .... 0

Que el último número sea cero es importante: adoptar el insumo no hacía perder
ningún archivo. Aun así se portó cambio por cambio, porque había cuatro puntos
en los que el proyecto **se aparta del insumo a propósito**.

## Las cuatro divergencias que se conservaron

**1. `auth.middleware.js`.** El proyecto distingue los errores propios de
jsonwebtoken del resto:

    const ERRORES_DE_TOKEN = [
      "JsonWebTokenError",
      "TokenExpiredError",
      "NotBeforeError"
    ];

Si el error no es uno de esos tres, se hace `return next(error)`. El insumo no
lo tiene y convierte cualquier excepción en 401. Con la versión del insumo, si
faltara `JWT_SECRET` el servidor respondería "Token inválido" a un fallo de
configuración suyo. Se conservó la del proyecto.

**2. `usuarios.service.js`.** El proyecto tiene `ROLES` y `ROL_POR_DEFECTO` como
constantes del dominio desde el Lab 8. El insumo no las tiene. Se **fusionó**:
se conservaron las constantes y se añadieron las dos funciones nuevas.

**3. `jwt.util.js`.** El insumo usa `obtenerConfiguracionJWT()` devolviendo
`{secret, expiresIn}`. El proyecto usa `obtenerSecreto()` y
`obtenerExpiracion()` por separado. Comportamiento idéntico; se conservaron los
nombres del proyecto.

**4. `app.js`.** El proyecto parametriza el rate limit con `RATE_LIMIT_MAX`
desde el Lab 5. El insumo lo tiene fijo en 100. Se conservó la parametrización y
se le añadió el arranque controlado.

Además, `password.util.js` figuraba como "diferencia real" pero resultó ser una
coma final: es funcionalmente idéntico.

---

# Lo que se construyó

## Cinco archivos nuevos

**`src/middlewares/roles.middleware.js`**
`autorizarRoles(...rolesPermitidos)`. Devuelve un middleware; los puntos
suspensivos son lo que lo hace reutilizable.

**`src/middlewares/propiedad.middleware.js`**
Tres funciones: `autorizarPacientePropio`, `autorizarMedicoPropio` y
`autorizarAccesoCita`. Aquí vive la defensa contra BOLA.

**`src/middlewares/usuarios.validator.js`**
`validarCreacionUsuario`. Acepta `rol`, pero solo `medico` o `administrador`.

**`src/controllers/usuarios.controller.js`**
`crearUsuario` administrativo, con el 409 de email duplicado.

**`src/routes/usuarios.routes.js`**
`POST /api/usuarios`, protegida con `autorizarRoles("administrador")`.

## Lo que cambió en lo que ya existía

| Archivo | Qué se le añadió |
|---|---|
| `data/pacientes.js`, `data/medicos.js` | `usuarioId: null` en los registros semilla |
| `services/pacientes.service.js` | `obtenerPacientePorUsuarioId` + persistir `usuarioId` |
| `services/medicos.service.js` | `obtenerMedicoPorUsuarioId` + persistir `usuarioId` |
| `services/usuarios.service.js` | `crearUsuarioAdministrativo` + `crearAdministradorInicial` |
| `middlewares/*.validator.js` | `usuarioId` opcional en pacientes y médicos |
| `controllers/pacientes.controller.js` | validación de la asociación usuario↔paciente |
| `controllers/medicos.controller.js` | lo mismo para médicos |
| `controllers/citas.controller.js` | `obtenerMisCitas` |
| Las 5 rutas de recursos | `autenticarJWT` + `autorizarRoles` + Swagger |
| `app.js` | arranque controlado + `/api/usuarios` |
| `docs/swagger.js` | tag `Usuarios` |

## El salto que importa en el orden de los middlewares

    DELETE /api/pacientes/1
        |
    API Key          (app.js, desde el Lab 6)
        |
    autenticarJWT    -> req.usuario
        |
    autorizarRoles("administrador")
        |
    validarIdPaciente / validar
        |
    controller -> service -> reglas de negocio

Primero se decide **si puede**, y solo después se procesan los datos. Un
paciente que manda un JSON perfectamente válido a `POST /api/pacientes` recibe
403 **sin que el validator llegue a ejecutarse**. No tiene sentido gastar
trabajo validando una petición que no está autorizada.

[Captura: el árbol de src/ con los cinco archivos nuevos]

---

# El bootstrap: ¿quién crea al primer administrador?

Es el problema del huevo y la gallina. Solo un administrador puede crear
administradores, pero alguien tiene que crear el primero.

No se puede meter una contraseña en texto plano dentro de `usuarios.js`, así que
va en `.env`:

    ADMIN_NOMBRE=Administrador Hospital
    ADMIN_EMAIL=<oculto>
    ADMIN_PASSWORD=<la del laboratorio>

Y en `.env.example`, `ADMIN_PASSWORD=REEMPLAZAR_CON_PASSWORD_SEGURO`.

`crearAdministradorInicial()` se ejecuta **al arrancar la API, no por HTTP**. Si
el administrador ya existe, no hace nada.

## El arranque dejó de ser `app.listen` a secas

Como bcrypt es asíncrono, el arranque pasó a ser controlado:

    const iniciarServidor = async () => {
      try {
        await usuariosService.crearAdministradorInicial();
        app.listen(PORT, () => { ... });
      } catch (error) {
        console.error("Error al iniciar el servidor:", error.message);
        process.exit(1);
      }
    };

    CONFIGURAR -> INICIALIZAR DATOS -> SI TODO ESTÁ BIEN -> ABRIR PUERTO

En vez de abrir el puerto y descubrir después que una inicialización crítica
falló. Es la misma idea de *fail fast* del Lab 6, ahora aplicada a los datos.

## El log no filtra nada

El arranque imprime:

    Administrador inicial creado
    Servidor ejecutándose en http://localhost:3000

Y nada más. Se verificó: **0 coincidencias** de `admin@hospital`, de la
contraseña y de `$2b$` en el log. El mensaje confirma que pasó algo sin decir a
quién ni con qué credenciales.

[Captura: la terminal con "Administrador inicial creado"]

---

# Los tres caminos para crear un usuario

Esta es la parte que más ordena el modelo de confianza.

| Camino | Quién puede | Rol resultante |
|---|---|---|
| Bootstrap, al arrancar | nadie por HTTP | `administrador` |
| `POST /api/auth/registro` | cualquiera con API Key | `paciente`, siempre |
| `POST /api/usuarios` | solo administrador autenticado | `medico` o `administrador` |

## Por qué `POST /api/usuarios` sí acepta `rol` y el registro público no

Parece una contradicción con el Lab 8, y no lo es.

En el registro público el `rol` **no está en el contrato de entrada**: lo
descarta `matchedData` y el service escribe `ROL_POR_DEFECTO`. En la operación
administrativa el `rol` **sí se acepta**, porque antes de llegar al validator la
petición ya pasó por `autorizarRoles("administrador")`.

La frase del PDF lo resume: *un campo no es inseguro por existir en una
petición; el problema es quién está autorizado a controlarlo.*

Y se mantuvieron **dos funciones separadas** en el service, `crearUsuario()` y
`crearUsuarioAdministrativo()`. La tentación habría sido escribir
`rol: datos.rol || "paciente"` en la primera y reutilizarla, pero eso habría
vuelto a debilitar la garantía del registro público.

---

# RBAC: la política aplicada

| Recurso | Administrador | Médico | Paciente |
|---|---|---|---|
| Pacientes | CRUD | GET | — |
| Especialidades | CRUD | GET | GET |
| Médicos | CRUD | GET | GET |
| Consultorios | CRUD | GET | GET |
| Citas | CRUD | ver abajo | ver abajo |

El paciente no entra a `/api/pacientes` porque esa es la **colección completa**.
Lo suyo llega por otro camino, que es la siguiente sección. Y se le permite GET
sobre médicos y especialidades porque los necesita para elegir con quién pedir
cita.

---

# BOLA: por qué RBAC no bastaba

Aquí está el corazón del laboratorio.

Supongamos que las citas se hubieran protegido solo con roles:

    autorizarRoles("administrador", "medico", "paciente")

El Paciente A, autenticado y con rol permitido, podría pedir:

    GET /api/citas/paciente/5

y el servidor comprobaría: ¿API Key válida? sí. ¿JWT válido? sí. ¿Rol
permitido? sí. Y devolvería **las citas del Paciente B**.

Eso es **IDOR / BOLA**:

- **IDOR** — Insecure Direct Object Reference. El identificador de la URL se
  puede manipular a mano.
- **BOLA** — Broken Object Level Authorization. El problema de fondo: el
  servidor no comprobó si el objeto le pertenece a quien lo pide.

No es que usar IDs en la URL esté mal. `GET /api/citas/15` es perfectamente
normal. El fallo es recibir el ID, buscar el objeto y devolverlo **sin preguntar
si ese usuario puede acceder a ese objeto**.

## Primero hubo que relacionar usuario y perfil

Había dos cosas distintas llamadas "médico":

    USUARIO  { id: 2, email: "medico@hospital.com", rol: "medico" }
    MÉDICO   { id: 1, nombre: "Carlos Rodríguez", registroMedico: "RM-45871" }

No estaban relacionadas. Y **no se usó el mismo id** para unirlas, porque sería
una asociación accidental: son recursos distintos con numeraciones distintas.

Se añadió `usuarioId` a `pacientes` y `medicos`. Los registros semilla llevan
`usuarioId: null`, porque existían antes del sistema de usuarios y no se debe
inventar a quién pertenecen.

## La asociación no se automatizó, y tiene reglas

La asocia un administrador al crear el perfil. Y no basta con que `usuarioId`
sea un entero:

    VALIDATOR          ->  ¿usuarioId es un entero positivo?
    REGLA DE NEGOCIO   ->  ¿ese usuario existe?        no -> 400
                       ->  ¿ese usuario es paciente?   no -> 409
                       ->  ¿ya tiene perfil?           sí -> 409

Las tres se probaron y las tres responden lo esperado.

## El middleware de propiedad

    JWT -> req.usuario.id -> obtenerPacientePorUsuarioId() -> paciente.id
                                                                  |
                                               comparar con req.params.pacienteId
                                                                  |
                                                      iguales -> next()
                                                   distintos -> 403

El administrador pasa siempre, sin comprobación de propiedad. Y hay un orden
deliberado en la ruta:

    validarIdPaciente -> validar -> autorizarPacientePropio

Primero se comprueba que el id sea un identificador válido y solo después se
compara. No tiene sentido comparar contra basura.

## `/mis-citas`: la identidad no viaja en la URL

Además de proteger `/paciente/:id`, se añadió un endpoint donde **no hay id que
manipular**:

    GET /api/citas/mis-citas

El servidor deduce de quién son las citas a partir del JWT. No hay parámetro que
cambiar, así que el ataque de IDOR ni siquiera se puede intentar. Es la forma
más sólida de resolverlo.

Detalle de implementación que importa: la ruta `/mis-citas` está declarada
**antes** que `/:id` en el router. Si fuera al revés, Express interpretaría
"mis-citas" como un id y la ruta nunca se alcanzaría. Se verificó el orden en el
archivo (línea 313 contra línea 540).

Está restringida a `paciente` y `medico`. El administrador recibe **403**, y es
correcto: un administrador no tiene citas propias, el endpoint no significa nada
para él.

[Captura: Paciente A pidiendo /paciente/4 con 200 y /paciente/5 con 403]

---

# Las pruebas

Escenario montado, que coincide con el del PDF:

    usuario 1  administrador  (bootstrap)
    usuario 2  medico         -> perfil medico   id 4
    usuario 3  Paciente A     -> perfil paciente id 4   -> cita 4
    usuario 4  Paciente B     -> perfil paciente id 5   -> cita 5

## Las 30 pruebas obligatorias

| # | Prueba | Esperado | Obtenido |
|---|---|---|---|
| 1 | Sin JWT → `/api/pacientes` | 401 | **401** `Token de autenticación requerido` |
| 2 | JWT alterado → `/api/pacientes` | 401 | **401** `Token inválido` |
| 3 | Paciente → `GET /api/pacientes` | 403 | **403** |
| 4 | Médico → `POST /api/pacientes` | 403 | **403** |
| 5 | Admin → `GET /api/pacientes` | 200 | **200** |
| 6 | Registro con `rol:"administrador"` | 201 + paciente | **201**, `rol=paciente` |
| 7 | Registro con `activo:false` | 201 + true | **201**, `activo=true` |
| 8 | Registro con `passwordHash` falso | 201, ignorado | **201** |
| 9 | Registro con `esSuperAdmin:true` | 201, ignorado | **201** |
| 10 | Médico → `POST /api/usuarios` | 403 | **403** |
| 11 | Paciente A → sus citas | 200 | **200** |
| 12 | Paciente A → citas de B | 403 | **403** `No tiene permisos para acceder a este recurso` |
| 13 | Paciente A → su cita individual | 200 | **200** |
| 14 | Paciente A → cita individual de B | 403 | **403** `No tiene permisos para acceder a esta cita` |
| 15 | Médico A → sus citas | 200 | **200** |
| 16 | Médico A → citas del médico 1 | 403 | **403** |
| 17 | Médico A → cita asignada a él | 200 | **200** |
| 18 | Médico A → cita de otro médico | 403 | **403** |
| 19 | Paciente → `/mis-citas` | 200, solo suyas | **200**, 1 cita, la suya |
| 20 | Médico → `/mis-citas` | 200, solo suyas | **200**, 2 citas, ambas con su `medicoId` |
| 21 | Admin → `/mis-citas` | 403 | **403** |
| 22 | Paciente sin perfil → `/mis-citas` | 403 | **403** `El usuario no tiene un paciente asociado` |
| 23 | Médico sin perfil → `/mis-citas` | 403 | **403** `El usuario no tiene un médico asociado` |
| 24 | Admin → `GET /api/citas` | 200 | **200** |
| 25 | Paciente → `GET /api/citas` | 403 | **403** |
| 26 | Médico → `GET /api/citas` | 403 | **403** |
| 27 | Paciente → `POST /api/citas` | 403 | **403** |
| 27b | Médico → `POST /api/citas` | 403 | **403** |
| 28 | Paciente → `PATCH /api/citas/4` | 403 | **403** |
| 28b | Médico → `DELETE /api/citas/4` | 403 | **403** |
| 29 | Paciente → `PATCH /citas/4/estado` | 403 | **403** |
| 29b | Médico → `PATCH /citas/4/estado` | 403 | **403** |
| 30 | Sin `X-API-Key` | rechazado | **401** `API Key requerida` |

**33 de 33 pasan.**

## Pruebas adicionales de la tabla de 55

| # | Prueba | Esperado | Obtenido |
|---|---|---|---|
| 17 | Admin crea administrador | 201 | **201** |
| 20 | Admin intenta `rol:"superadmin"` | 400 | **400** `Datos de entrada inválidos` |
| 21 | Paciente con `usuarioId` inexistente | 400 | **400** `El usuario asociado no existe` |
| 22 | Paciente con `usuarioId` de un admin | 409 | **409** `El usuario asociado no tiene rol paciente` |
| 23 | Mismo usuario a dos pacientes | 409 | **409** `El usuario ya está asociado a un paciente` |
| 24 | Médico con `usuarioId` inexistente | 400 | **400** |
| 25 | Médico con `usuarioId` de un paciente | 409 | **409** `El usuario asociado no tiene rol medico` |
| 26 | Mismo usuario a dos médicos | 409 | **409** `El usuario ya está asociado a un médico` |
| 10 | Admin borra paciente **con citas** | 409 | **409** integridad referencial |
| 10b | Admin borra médico **con citas** | 409 | **409** integridad referencial |
| 39 | Admin consulta cita de cualquiera | 200 | **200** |
| 54 | Admin transición válida | 200 | **200** |
| 55 | Admin transición inválida | 409 | **409** |
| — | Paciente → `GET /api/especialidades` | 200 | **200** |
| — | Paciente → `POST /api/especialidades` | 403 | **403** |
| — | Paciente → `GET /api/medicos` | 200 | **200** |
| — | Paciente → `POST /api/medicos` | 403 | **403** |
| — | Médico → `GET /api/pacientes` | 200 | **200** |

**18 de 18 pasan. Total: 51 de 51.**

## Las dos pruebas que más valen

**Ser administrador no permite saltarse las reglas de negocio.** Las pruebas 10,
10b y 55 lo demuestran: el administrador está perfectamente autorizado, y aun
así recibe 409 al intentar borrar un paciente con citas o al hacer una
transición de estado prohibida. La autorización decide *si puedes intentarlo*,
no *si el sistema te deja romperlo*.

**El 403 por rol y el 403 por propiedad son distintos.** Comparten código pero
no mensaje:

    rol no permitido   ->  "No tiene permisos para realizar esta operación"
    recurso ajeno      ->  "No tiene permisos para acceder a este recurso"
    cita ajena         ->  "No tiene permisos para acceder a esta cita"
    sin perfil         ->  "El usuario no tiene un paciente asociado"

[Captura: la tabla completa de pruebas en la terminal]

---

# El spec

    rutas     : 18 -> 20
    endpoints : 38 -> 40
    schemas   : 19 -> 20
    tags      :  7 ->  8

    rutas nuevas: /api/usuarios, /api/citas/mis-citas
    tag nuevo   : Usuarios
    referencias rotas: NINGUNA

    operaciones que exigen ApiKeyAuth + BearerAuth en el mismo objeto: 37

Ese último número es el que importa para que el contrato publicado coincida con
la implementación. Las 37 operaciones protegidas declaran los dos esquemas
**dentro de un mismo objeto**, que en OpenAPI significa Y. Si fueran dos objetos
distintos significaría O, y el spec estaría diciendo que basta con una sola
credencial.

Las 3 operaciones que no los exigen son las que no deben: el registro, el login
y el endpoint de cliente de la API Key.

---

# Semgrep y npm audit

| | Lab 9 | Lab 10 |
|---|---|---|
| Reglas | 73 | 73 |
| Archivos | 42 | **47** |
| Hallazgos | 0 | **0** |
| Dependencias | 10 | **10** |

+5 archivos, exactamente los cinco nuevos. Cero dependencias añadidas: todo el
Lab 10 se resolvió con lo que ya había.

## Windows bloqueó semgrep.exe

Esta vez sí ocurrió:

    /c/Users/.../Scripts/semgrep: Permission denied

Se usó el fallback:

    python -c "from semgrep.console_scripts.pysemgrep import main; main()" \
      --config p/javascript --config p/nodejs --config p/owasp-top-ten src/

Mismo resultado, 73 reglas sobre 47 archivos. Queda anotado en el propio archivo
de evidencia para que se entienda por qué el comando es distinto al de los
laboratorios anteriores.

Evidencias: `sast-semgrep-lab10.txt` y `sca-npm-audit-lab10.txt`.

---

# Lo que este laboratorio no resuelve

**El médico ve las citas de todos sus pacientes, y eso es correcto, pero no hay
matices.** Un médico accede a cualquier cita donde figure como `medicoId`. No
hay noción de "ya no atiendo a este paciente" ni de histórico cerrado.

**Los perfiles semilla siguen con `usuarioId: null`.** Los tres pacientes y los
tres médicos originales no pertenecen a nadie. Nadie puede reclamarlos vía
`/mis-citas`, que es lo seguro, pero tampoco son utilizables por un usuario real
hasta que un administrador los asocie.

**La asociación usuario↔perfil es manual.** Registrarse crea un usuario, no un
paciente. Alguien tiene que crear el perfil y enlazarlo. Se dejó así a propósito
porque el perfil pide datos que el registro no recoge (documento, teléfono,
fecha de nacimiento), pero es un paso que hoy nadie fuerza: puede haber usuarios
con rol `paciente` sin perfil, y de hecho la prueba 22 depende de eso.

**La relación 1:1 se garantiza en el controller, no en los datos.** Nada impide
que un `usuarios.push` desde otro punto del código rompa la unicidad. Con
PostgreSQL esto será un `UNIQUE(usuario_id)` y dejará de depender de que todos
los caminos recuerden comprobarlo.

**Ni médicos ni pacientes pueden escribir nada.** Toda la escritura es del
administrador. Un médico no puede marcar una cita como atendida, que es
probablemente lo primero que pediría un hospital real. Es la política inicial
del laboratorio, no la definitiva.

**Sigue sin poder revocarse un token**, y los usuarios **siguen en memoria**:
todo esto se pierde al reiniciar, incluido el enlace usuario↔perfil.

---

# Resumen

| Antes (Lab 9) | Ahora (Lab 10) |
|---|---|
| El rol viajaba en el JWT y no hacía nada | El rol decide qué operaciones se permiten |
| Un paciente llamaba a todo | Un paciente recibe 403 en lo que no le toca |
| No existía el rol `medico` en la práctica | Se crea por operación administrativa |
| Cualquiera autenticado veía cualquier cita | Solo las suyas; `/paciente/:id` ajeno da 403 |
| No había `/mis-citas` | La identidad se deduce del JWT, sin id manipulable |
| Usuarios y perfiles sin relación | `usuarioId` enlaza usuario con paciente/médico |
| 38 endpoints | 40 endpoints |
| 42 archivos en Semgrep | 47 archivos, 0 hallazgos |

Las cuatro preguntas quedan separadas:

    API KEY  ->  ¿qué aplicación consume?
    JWT      ->  ¿qué usuario es?
    ROL      ->  ¿qué operaciones puede hacer?
    OBJETO   ->  ¿sobre qué datos concretos?

Y por debajo de las cuatro siguen estando los validators, las reglas de negocio
y la integridad referencial. Autenticación no sustituye validación, y
autorización no sustituye las reglas de negocio.

# Archivos de evidencia

| Archivo | Qué contiene |
|---|---|
| `sast-semgrep-lab10.txt` | Semgrep tras el Lab 10, 47 archivos, 0 hallazgos |
| `sca-npm-audit-lab10.txt` | npm audit y npm ls, 10 dependencias |
| `informe-lab9.md` | Informe del laboratorio anterior |

# Pendiente

Las capturas, y llevar el bloque al proyecto del equipo, que es la otra mitad
del entregable.
