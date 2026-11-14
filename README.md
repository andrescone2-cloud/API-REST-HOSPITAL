# API HOSPITAL SEGURA 

Proyecto para el desarrollo y análisis de seguridad de una API REST hospitalaria utilizando Node.js, Express, Swagger/OpenAPI y herramientas de análisis SAST, SCA y DAST.

---

# 1. OBJETIVO DEL PROYECTO

Construir una API REST para gestionar:

- pacientes;
- especialidades;
- médicos;
- consultorios;
- citas médicas;
- habitaciones;
- ingresos / hospitalizaciones.

El proyecto permite formalizar:

- arquitectura de una API REST;
- rutas;
- controllers;
- services;
- middlewares;
- validación de datos;
- relaciones entre recursos;
- reglas de negocio;
- protección contra Mass Assignment;
- documentación OpenAPI;
- Swagger UI;
- análisis SAST;
- análisis SCA;
- análisis DAST.

Los datos se almacenan inicialmente en memoria mediante archivos JavaScript.

Esta arquitectura será posteriormente adaptable a BaaS

# Directorio
mkdir API_HOSPITAL
npm init -y
cd API_HOSPITAL


# INSTALAR EXPRESS
npm install express
# INSTALAR DEPENDENCIAS DE SEGURIDAD Y VALIDACIÓN
npm install helmet cors express-rate-limit express-validator dotenv

## Recordemos que:
- helmet
→ agrega encabezados HTTP de seguridad

- cors
→ controla los orígenes permitidos

- express-rate-limit
→ limita solicitudes repetidas

- express-validator
→ valida parámetros y datos recibidos

- dotenv
→ carga variables de entorno desde .env

# INSTALAR SWAGGER
npm install swagger-ui-express swagger-jsdoc

## Recordemos que estas dependencias permiten:
Swagger UI
→ visualizar y probar la API

OpenAPI
→ describir formalmente los endpoints

# INSTALAR NODEMON
npm install --save-dev nodemon

# CONFIGURAR LOS SCRIPTS

## Abrir:
package.json

## Buscar:

"scripts": {
  "test": "echo \"Error: no test specified\" && exit 1"
}

## y reemplazarlo por:

"scripts": {
  "start": "node src/app.js",
  "dev": "nodemon src/app.js"
}

# CREAR EL ARCHIVO .ENV
# CREAR .ENV.EXAMPLE
# CREAR .GITIGNORE

# copiar el src y validar la estructura:
API_HOSPITAL/
│
├── src/
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── citas.controller.js
│   │   ├── consultorios.controller.js
│   │   ├── especialidades.controller.js
│   │   ├── habitaciones.controller.js
│   │   ├── ingresos.controller.js
│   │   ├── medicos.controller.js
│   │   └── pacientes.controller.js
│   │
│   ├── data/
│   │   ├── apiKeys.js
│   │   ├── citas.js
│   │   ├── consultorios.js
│   │   ├── especialidades.js
│   │   ├── habitaciones.js
│   │   ├── ingresos.js
│   │   ├── medicos.js
│   │   ├── pacientes.js
│   │   └── usuarios.js
│   │
│   ├── docs/
│   │   └── swagger.js
│   │
│   ├── middlewares/
│   │   ├── alias.middleware.js
│   │   ├── apiKey.middleware.js
│   │   ├── auth.validator.js
│   │   ├── citas.validator.js
│   │   ├── consultorios.validator.js
│   │   ├── errores.middleware.js
│   │   ├── especialidades.validator.js
│   │   ├── habitaciones.validator.js
│   │   ├── ingresos.validator.js
│   │   ├── medicos.validator.js
│   │   ├── pacientes.validator.js
│   │   └── validar.middleware.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── citas.routes.js
│   │   ├── consultorios.routes.js
│   │   ├── especialidades.routes.js
│   │   ├── habitaciones.routes.js
│   │   ├── ingresos.routes.js
│   │   ├── medicos.routes.js
│   │   ├── pacientes.routes.js
│   │   └── seguridad.routes.js
│   │
│   ├── services/
│   │   ├── apiKeys.service.js
│   │   ├── citas.service.js
│   │   ├── consultorios.service.js
│   │   ├── especialidades.service.js
│   │   ├── habitaciones.service.js
│   │   ├── ingresos.service.js
│   │   ├── medicos.service.js
│   │   ├── pacientes.service.js
│   │   └── usuarios.service.js
│   │
│   ├── utils/
│   │   ├── crypto.util.js
│   │   └── password.util.js
│   │
│   └── app.js
│
├── database/
│   ├── 04_migracion_especificacion.sql
│   └── 05_trazabilidad_ingresos.sql
│
├── scripts/
│   └── migrar-especificacion.js
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md

# EJECUTAR LA API
npm run dev

---
Servidor ejecutándose en http://localhost:3000

Swagger UI:
http://localhost:3000/api-docs

OpenAPI JSON:
http://localhost:3000/openapi.json
---

# VARIABLES DE ENTORNO

Van en `.env`, que está en `.gitignore` y nunca se sube al repositorio.
`.env.example` lleva las mismas claves con valores de relleno.

| Variable | Obligatoria | Por defecto | Para qué sirve |
|---|---|---|---|
| `PORT` | No | 3000 | Puerto del servidor |
| `ALLOWED_ORIGIN` | No | — | Origen permitido por CORS |
| `RATE_LIMIT_MAX` | No | 100 | Peticiones permitidas por ventana de 15 min sobre `/api`. Se sube solo para escanear con ZAP: `RATE_LIMIT_MAX=100000 npm run dev` |
| `API_KEY_POSTMAN` | **Sí** | — | API Key del cliente "Postman Laboratorio" |
| `API_KEY_ADMIN` | **Sí** | — | API Key del cliente "Aplicación Administrativa" |
| `API_KEY_MOVIL` | **Sí** | — | API Key del cliente "Aplicación Móvil" |
| `JWT_SECRET` | **Sí, para el login** | — | Secreto con el que se firman los JWT. 64 bytes aleatorios en hexadecimal |
| `JWT_EXPIRES_IN` | No | `1h` | Tiempo de vida del token. Acepta `1h`, `20s`, `7d`… |
| `ADMIN_NOMBRE` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | **Sí** | — | Administrador inicial que crea el bootstrap al arrancar |
| `DATABASE_URL` | **Sí** | — | Cadena de conexión a PostgreSQL en Supabase (Connect → Connection pooling, puerto 6543) |

Las tres claves se generan así, una ejecución por clave:

    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Y el secreto de JWT, del doble de tamaño:

    node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

## Si falta una clave, el servidor NO arranca

`src/data/apiKeys.js` valida las tres variables al cargarse y lanza un error
si falta alguna:

    Error: Faltan variables de entorno para las API Keys
        at Object.<anonymous> (src/data/apiKeys.js:25:9)

El proceso muere con exit code 1 durante la carga de módulos, antes del
`app.listen`. El puerto nunca llega a escuchar.

Esto es deliberado. Antes, una variable ausente dejaba el servidor arrancado
pero devolviendo 500 en cada petición: parecía vivo y estaba roto. Ahora el
fallo es ruidoso, inmediato y una sola vez. En un despliegue, el contenedor no
pasa el health check y no entra a producción, en vez de entrar y servir errores.

---

# AUTENTICACIÓN POR API KEY

Todas las rutas bajo `/api` exigen la cabecera:

    X-API-Key: <clave>

La clave solo se acepta en la cabecera. En la query string (`?apiKey=...`) no
funciona, a propósito: las URLs acaban registradas en historiales, logs y
proxies, y un secreto en la URL es un secreto filtrado.

## Las claves no se guardan en claro

`src/data/apiKeys.js` simula la tabla que más adelante será `api_keys` en
PostgreSQL/Supabase. De cada clave guarda **solo su hash SHA-256**, nunca el
valor original:

| id | cliente | activa |
|---|---|---|
| 1 | Postman Laboratorio | `true` |
| 2 | Aplicación Administrativa | `true` |
| 3 | Aplicación Móvil | `false` |

**El cliente 3 está deshabilitado a propósito**, para demostrar que se puede
revocar un consumidor sin tocar a los demás.

El flujo de verificación es:

    X-API-Key recibida
        ↓
    SHA-256
        ↓
    comparar contra los hashes almacenados (timingSafeEqual)
        ↓
    match -> cliente    |    no match -> 401

Nunca hace falta recuperar la clave original desde el hash.

`crypto` es un módulo nativo de Node, no se instala con npm.

## Quién consume la API

Cuando la clave es válida y está activa, el middleware adjunta a la petición:

    req.clienteApi = { id, nombre }

y el endpoint `GET /api/seguridad/cliente` lo devuelve. La misma URL responde
un cliente distinto según la clave enviada.

---

# CÓDIGOS DE RESPUESTA

| Código | Cuándo |
|---|---|
| 200 | Petición correcta |
| 201 | Recurso creado |
| 400 | Datos o id inválidos (lo corta el validator) |
| 401 | API Key ausente o inválida — *no sé quién eres* |
| 403 | API Key válida pero deshabilitada — *sé quién eres, pero no pasas* |
| 404 | El recurso no existe |
| 409 | Petición válida que choca con el estado actual: integridad referencial, transición de estado no permitida, doble reserva, habitación ocupada o en mantenimiento |
| 429 | Se superó el rate limit |
| 500 | Error interno |

---

# ENDPOINTS

47 en total. Todos bajo `/api` exigen `X-API-Key`.

| Métodos | Ruta |
|---|---|
| GET, POST | `/api/pacientes` |
| GET, PUT, PATCH, DELETE | `/api/pacientes/{id}` |
| GET, POST | `/api/especialidades` |
| GET, PUT, PATCH, DELETE | `/api/especialidades/{id}` |
| GET, POST | `/api/medicos` |
| GET | `/api/medicos/especialidad/{especialidadId}` |
| GET, PUT, PATCH, DELETE | `/api/medicos/{id}` |
| GET, POST | `/api/consultorios` |
| GET, PUT, PATCH, DELETE | `/api/consultorios/{id}` |
| GET, POST | `/api/citas` |
| GET | `/api/citas/paciente/{pacienteId}` |
| GET | `/api/citas/medico/{medicoId}` |
| GET, PUT, PATCH, DELETE | `/api/citas/{id}` |
| PATCH | `/api/citas/{id}/estado` |
| GET, POST | `/api/habitaciones` |
| GET | `/api/habitaciones/disponibles` |
| GET, PUT | `/api/habitaciones/{id}` |
| GET, POST | `/api/ingresos` |
| GET | `/api/ingresos/{id}` |
| PATCH | `/api/ingresos/{id}/dar-alta` |
| GET | `/api/seguridad/cliente` |
| POST | `/api/auth/registro` |
| POST | `/api/auth/login` |
| GET | `/api/auth/perfil` |

Públicas, sin API Key: `/`, `/api-docs` y `/openapi.json`.

`GET /api/auth/perfil` es el único que además exige JWT.

Habitaciones e ingresos se protegen con JWT y rol: leen administrador y médico;
solo el administrador crea o edita habitaciones. Un ingreso exige una habitación
disponible, la marca `ocupada`, y `dar-alta` la devuelve a `disponible`. La fecha
de alta no puede ser anterior a la de ingreso. Cada ingreso guarda quién lo
registró (`registradoPor`), quién dio el alta (`altaPor`) y cuándo se creó
(`creadoEn`); los toma el servidor del JWT, el cliente no puede enviarlos. `correo` y `licenciaMedica` se
aceptan como alias de `email` y `registroMedico`.

---

# AUTENTICACIÓN DE USUARIOS

La API Key dice **qué aplicación** consume la API. El email y la contraseña
dicen **qué persona**. Son dos niveles distintos y ambos hacen falta:
`/api/auth/registro` y `/api/auth/login` cuelgan de `/api`, así que también
exigen `X-API-Key`.

| Endpoint | Qué hace |
|---|---|
| `POST /api/auth/registro` | Crea un usuario con su contraseña hasheada |
| `POST /api/auth/login` | Verifica email y contraseña |

## Las contraseñas se guardan con bcrypt, cost 12

No se usa SHA-256 aquí, a diferencia de las API Keys. El motivo es la entropía.
Una API Key son 32 bytes aleatorios y no hay diccionario que la cubra. Una
contraseña humana como `Hospital2026` sí está en los diccionarios, así que hace
falta una función **lenta a propósito**.

    const SALT_ROUNDS = 12;
    await bcrypt.hash(password, SALT_ROUNDS);

El cost 12 es el trabajo computacional por intento. Cuanto más alto, más caro le
sale a un atacante probar millones de contraseñas.

## La sal va dentro del propio hash

No hay columna `salt` aparte. bcrypt genera una sal aleatoria por contraseña y
la guarda dentro del hash resultante:

    $2b$12$Hp2UP4uXDsmMENxo9CXnAO9Wpb47NrMzDs5zCw6AQdQczvHzLGpE2
    │   │  └── sal + resultado derivado
    │   └───── cost factor
    └───────── variante de bcrypt

Por eso dos usuarios con **la misma contraseña** acaban con hashes distintos:

    <ADMIN_EMAIL>   $2b$12$Hp2UP4uXDsmMENxo9CXnAO...
    medico@hospital.com  $2b$12$7hfjrGt.WDCZlmWEIDmuBe...

Sin sal, los dos hashes serían idénticos y se vería a simple vista que comparten
contraseña.

## Los tres roles, y quién los decide

`administrador`, `medico` y `paciente`.

Están definidos una sola vez, en la constante `ROLES` de
`src/services/usuarios.service.js`.

**El rol lo asigna el servidor. El cliente no puede definirlo.**

Todo usuario creado por el registro público nace como `paciente`, el menos
privilegiado de los tres:

    const ROL_POR_DEFECTO = "paciente";

`rol` no forma parte del schema de entrada del registro. Si un cliente lo manda
de todas formas, se descarta sin error: la petición devuelve **201** y el
usuario se crea igualmente como `paciente`.

    POST /api/auth/registro
    { "nombre": "...", "email": "...", "password": "...", "rol": "administrador" }

    201  ->  { ..., "rol": "paciente", "activo": true }

Son dos defensas encadenadas, y cada una basta por sí sola:

1. `auth.validator.js` no declara `rol`, así que `matchedData` lo descarta antes
   de llegar al controlador.
2. `usuarios.service.js` escribe `rol: ROL_POR_DEFECTO` y no lee `datos.rol` en
   ningún punto.

## Campos administrados por el servidor

Estos campos nunca se toman del cuerpo de la petición, aunque el cliente los
envíe:

| Campo | Lo fija el servidor como |
|---|---|
| `id` | Siguiente disponible (`max + 1`) |
| `passwordHash` | Hash bcrypt de la contraseña recibida |
| `rol` | `paciente` |
| `activo` | `true` |

El objeto se construye campo por campo con un literal explícito, nunca con
spread del cuerpo. Un campo que no aparezca en esa lista, como `esSuperAdmin` o
`permisos`, simplemente no llega a existir.

## El schema de entrada del registro

`RegistroUsuario` acepta exactamente tres campos, los tres obligatorios:

| Campo | Tipo | Obligatorio |
|---|---|---|
| `nombre` | string, 3 a 100 caracteres | sí |
| `email` | email válido | sí |
| `password` | string, 10 a 72 caracteres | sí |

No incluye `rol`. El schema refleja el contrato real: si siguiera anunciando un
campo que el servidor ignora, estaría documentando algo falso.

En la **respuesta** sí aparece `rol`, porque ahí lo dice el servidor.

## La contraseña nunca sale en una respuesta

Ni la contraseña ni su hash. Los controladores **arman la respuesta campo por
campo** en lugar de devolver el objeto usuario, que sí lleva `passwordHash`
dentro.

    registro -> id, nombre, email, rol, activo
    login    -> id, nombre, email, rol

Un hash no es la contraseña, pero sigue siendo material sensible: si se filtra,
se puede atacar sin prisa y sin conexión.

## El 401 del login no dice qué falló

Tanto si el correo no existe como si la contraseña es incorrecta, la respuesta
es exactamente la misma:

    401
    { "mensaje": "Credenciales inválidas" }

No se responde "el usuario no existe" ni "la contraseña es incorrecta".

El motivo es la **enumeración de usuarios**. Si las dos respuestas fueran
distintas, cualquiera podría ir probando correos uno por uno y quedarse con la
lista de los que sí están registrados, sin acertar una sola contraseña. Esa
lista vale para phishing o para concentrar ataques sobre cuentas que sabe que
existen.

---

# AUTENTICACIÓN CON JWT

Desde el Lab 9, el login no solo dice "correcto": devuelve un **token** que
sirve para las peticiones siguientes.

    POST /api/auth/login
    { "email": "...", "password": "..." }

    200
    {
      "mensaje": "Autenticación correcta",
      "usuario": { "id": 1, "nombre": "...", "email": "...", "rol": "paciente" },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }

Ese token se manda después en la cabecera:

    Authorization: Bearer eyJ...

## Las dos credenciales no se sustituyen

Son preguntas distintas y hacen falta las dos:

| Credencial | Responde | Ejemplo |
|---|---|---|
| `X-API-Key` | ¿Qué aplicación consume la API? | Aplicación Administrativa |
| `email` + `password` | ¿Las credenciales son correctas? | paciente@hospital.com |
| JWT | ¿Qué usuario está autenticado? | `eyJ...` |
| `rol` | ¿Qué puede hacer? | `paciente` *(aún sin efecto)* |

Tras pasar los dos middlewares, la petición lleva dos objetos:

    req.clienteApi  ->  quién consume   (de la API Key)
    req.usuario     ->  quién es        (del JWT)

El login **no** exige JWT, y no podría: sería imposible pedir un token para
obtener el token.

## Qué lleva el token

    sub    ->  id del usuario
    email  ->  correo
    rol    ->  rol actual
    iat    ->  cuándo se emitió
    exp    ->  cuándo vence

**Nunca la contraseña ni el `passwordHash`.**

## Firmar no es cifrar

El payload va en **base64, no cifrado**. Cualquiera con el token puede leerlo
sin conocer `JWT_SECRET`:

    node -e "console.log(require('jsonwebtoken').decode('<token>'))"

La firma no oculta el contenido. Sirve para dos cosas: detectar que nadie
alteró el token, y demostrar que lo emitió quien tiene el secreto.

    jwt.decode()  ->  lee el contenido, NO comprueba nada
    jwt.verify()  ->  lee + comprueba firma + comprueba expiración

Por eso el middleware usa `verify`, nunca `decode`. Y por eso no se mete nada
secreto en el payload.

## El algoritmo va fijo

    algorithm:  "HS256"     al firmar
    algorithms: ["HS256"]   al verificar

La segunda línea importa. Un JWT declara en su cabecera con qué algoritmo dice
estar firmado. Sin restringir, la librería le haría caso al token, y bastaría
mandar uno con `"alg": "none"` y sin firma para entrar.

## Respuestas del middleware JWT

Desde el Bloque 7 no basta con que la firma sea válida: el middleware consulta la
identidad real en PostgreSQL y usa el **rol vigente en la base**, no el que venía
dentro del token. Si a alguien le bajan el rol o le desactivan la cuenta, su token
antiguo deja de servirle sin esperar a que expire.

| Situación | Código | Mensaje |
|---|---|---|
| Sin cabecera `Authorization` | 401 | `Token de autenticación requerido` |
| Formato distinto de `Bearer <token>` | 401 | `Formato de token inválido` |
| Firma alterada, secreto ajeno o `alg: none` | 401 | `Token inválido` |
| Token caducado | 401 | `Token expirado` |
| La cuenta ya no existe en la base | 401 | `La cuenta asociada al token no existe` |
| La cuenta está desactivada | 403 | `Usuario deshabilitado` |
| Fallo de configuración o base caída | 500 | `Error interno del servidor` |

La última fila es deliberada: un problema del servidor no se disfraza de
credencial inválida.

---

# PERSISTENCIA — PostgreSQL en Supabase

Desde el Bloque 7 los datos **ya no viven en arreglos de JavaScript**. Los
recursos del hospital consultan PostgreSQL.

| Service | Origen |
|---|---|
| especialidades, medicos, pacientes, consultorios, citas, habitaciones, ingresos, usuarios | PostgreSQL |
| apiKeys | memoria, a propósito: salen de `.env` |

## Puesta en marcha

Sin `DATABASE_URL` válida **la API no arranca**. Es deliberado: el arranque
comprueba que puede hablar con la base antes de abrir el puerto.

    Error al iniciar el servidor: getaddrinfo ENOTFOUND HOST
    exit code: 1

Pasos:

1. Crear el proyecto `hospitalsoft` en Supabase.
2. En SQL Editor, ejecutar **en orden**:

       database/01_esquema_hospital.sql
       database/02_roles_seguridad.sql
       database/03_verificacion.sql

   `01` no es idempotente: no ejecutarlo dos veces.

   Luego `database/04_migracion_especificacion.sql` y
   `database/05_trazabilidad_ingresos.sql` (ambas idempotentes), o
   `node scripts/migrar-especificacion.js`, que aplica las dos.

3. Copiar la cadena de **Connection pooling** (puerto 6543) en `DATABASE_URL`
   dentro de `.env`. Nunca en `.env.example`.

4. Comprobar:

       node scripts/probar-conexion.js
       npm run dev

El procedimiento completo está en `database/README.md` y en los cuatro
`docs/README_BLOQUE_7_*.md`.

## La conexión exige TLS verificado

`src/config/database.js` carga `certs/prod-ca-2021.crt` y abre el pool con
`rejectUnauthorized: true`. Sin eso la conexión iría cifrada pero aceptaría
cualquier certificado, y alguien podría ponerse en medio.

## El SQL va parametrizado

Toda entrada de usuario viaja por marcadores `$1, $2, …`. No hay concatenación de
datos del cliente dentro de las consultas. Semgrep lo confirma: 74 reglas, 0
hallazgos.

## Errores de PostgreSQL traducidos

| Código PG | Significa | Respuesta |
|---|---|---|
| `23505` | `unique_violation` | 409 Conflict |
| `ROL_INVALIDO` (propio) | El rol no existe en `public.roles` | 400 |

El correo duplicado ahora lo impide la restricción `UNIQUE` de la base, no solo
la comprobación previa del controller.

---

# LIMITACIONES CONOCIDAS

Cosas que este proyecto todavía **no** hace, a propósito, porque llegan en
laboratorios posteriores.

**Las políticas RLS todavía no están escritas.** `02_roles_seguridad.sql`
habilita Row Level Security en las siete tablas y revoca permisos a `anon` y
`authenticated`, pero no crea políticas por paciente o por médico. Hoy el control
de propiedad lo hace Express, no la base de datos. Se diseñarán al integrar
Supabase Auth.

**Los archivos `src/data/*.js` quedaron huérfanos.** Los seis arreglos en memoria
ya no los requiere nadie; se conservan como referencia del seed, pero son código
muerto.

**`usuarios.auth_user_id` existe y no se usa.** La columna espera a Supabase
Auth; mientras tanto autentica bcrypt + JWT desde Express.

**Un token no se puede revocar.** Un JWT vale hasta que expira y no hay forma de
anularlo antes. Si alguien roba un token de una hora, tiene una hora de acceso
aunque nos demos cuenta enseguida. No hay logout real, ni lista de tokens
revocados, ni refresh tokens. Es una característica de JWT, no un olvido: los
tokens son autocontenidos a propósito y el servidor no lleva registro de los
que emitió.

**Solo un endpoint usa JWT.** `GET /api/auth/perfil`, y existe para probar que
el mecanismo funciona. Los otros 37 siguen pidiendo solo la API Key.

**No hay control de IDOR/BOLA.** Aunque el servidor sepa que quien llama es el
paciente 1, nada le impide pedir los datos del paciente 2. Se comprueba que
estés autenticado, no que el recurso sea tuyo.

**No hay permisos por rol.** El rol ya viaja dentro del JWT y llega al servidor
en `req.usuario`, pero no cambia nada: un `paciente` autenticado puede llamar
exactamente a los mismos endpoints que un `administrador`. Ya sabemos *quién
eres*; falta decidir *qué puedes hacer*. Eso es la autorización RBAC.

**No hay forma de crear un administrador.** Es la otra cara de cerrar la
escalada de privilegios: como el registro público siempre asigna `paciente`, por
ahí no sale ningún administrador ni ningún médico. Falta la operación
administrativa que los cree, y esa necesita JWT y control de rol para saber
quién la está pidiendo.

El primer administrador saldrá de un **proceso controlado de inicialización o
seed** cuando exista base de datos: una migración o un script de arranque que
corra del lado del servidor. Nunca del registro público.

---

# realizar las pruebas y documentar
SAST → Semgrep
SCA  → npm audit
DAST → OWASP ZAP

docs y seguri


---

## Alineación con la especificación del Hospital

Se agregaron los recursos **Habitaciones** e **Ingresos** y los campos faltantes de Pacientes, Médicos y Citas. Ver `docs/ESPECIFICACION_API_HOSPITAL.md` y ejecutar `database/04_migracion_especificacion.sql` en Supabase antes de reiniciar la API.
