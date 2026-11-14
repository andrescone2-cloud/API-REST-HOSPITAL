# Laboratorio No. 6 — API_HOSPITAL

Múltiples clientes + API Keys almacenadas como hash.
Segundo corte. Fecha: 22 de septiembre de 2026.

Este laboratorio lo hice yo solo sobre el proyecto de referencia.
Aquí cuento qué cambié, qué probé y qué me encontré.

---

# El problema que venía arrastrando

En el Lab 5 dejé la API protegida con una API Key. Una sola, global, en `.env`:

    .env
      └── API_KEY=abc123...
              ↓
          Middleware
              ↓
          API Hospital

Funcionaba, pero tenía tres agujeros.

**No sabía quién pedía.** Si llegaba una petición con la clave correcta, la API
la dejaba pasar y ya. No tenía forma de saber si venía de Postman, de una app
administrativa o de una app móvil. Todos eran el mismo "alguien con la clave".

**No podía revocar a uno solo.** Si la clave se filtraba, mi única opción era
cambiarla. Y al cambiarla se la rompía a todo el mundo a la vez.

**Guardaba el secreto en claro.** La clave estaba tal cual en `.env`, y el
middleware la comparaba directamente contra lo que llegaba.

En este laboratorio paso de una clave global a tres clientes, cada uno con su
clave, y guardo solo el hash.

[Captura: el .env del Lab 5 con la única línea API_KEY]

---

# Los tres clientes

| id | cliente | activa |
|---|---|---|
| 1 | Postman Laboratorio | `true` |
| 2 | Aplicación Administrativa | `true` |
| 3 | Aplicación Móvil | **`false`** |

**La Aplicación Móvil está deshabilitada a propósito.** No es un error, es la
demostración de que puedo revocar un cliente sin tocar a los otros dos. Su clave
es perfectamente válida, hace match con su hash, pero no pasa.

Generé las tres claves con el comando del PDF, una ejecución por clave:

    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Son 32 bytes en hexadecimal, o sea 64 caracteres. Comprobé que las tres salieron
distintas.

[Captura: la terminal con las tres ejecuciones del comando]

En `.env` van así, y borré la `API_KEY` vieja:

    API_KEY_POSTMAN=<clave A>
    API_KEY_ADMIN=<clave B>
    API_KEY_MOVIL=<clave C>

En `.env.example` las mismas tres con `REEMPLAZAR_CON_API_KEY_SEGURA`.
`.gitignore` sigue con `.env`.

[Captura: .env y .env.example lado a lado]

---

# Por qué guardo el hash y no la clave

El objeto en memoria **no guarda** esto:

    { apiKey: "secreto..." }

Guarda esto:

    { hash: "30f0dcab0aa9..." }

La idea es que si alguien me lee el array de API Keys, no se lleva nada usable.
Un hash no se puede deshacer. Nunca necesito recuperar la clave original: cuando
llega una petición, hasheo lo que me mandan y comparo hash contra hash.

    X-API-Key recibida
        ↓
      SHA-256
        ↓
    comparar contra los hashes guardados
        ↓
    match → cliente    |    no match → 401

## Por qué SHA-256 sin sal me sirve aquí

Esta es la parte que quiero dejar clara, porque en el próximo laboratorio se da
la vuelta.

SHA-256 pelado, sin sal, me vale **en este caso concreto** porque mis API Keys
son 32 bytes aleatorios generados con `crypto.randomBytes`. Eso son 2^256
posibilidades. No hay diccionario, no hay lista de claves comunes, no hay tabla
precalculada que cubra ese espacio. Nadie va a adivinar por fuerza bruta una
cadena que salió de un generador criptográfico.

La sal sirve para dos cosas: que dos secretos iguales no produzcan el mismo
hash, y que no se puedan usar tablas precalculadas. Con claves aleatorias de 32
bytes ninguna de las dos es un problema real. Dos claves nunca van a coincidir,
y no existe tabla que las cubra.

**Con contraseñas de personas esto no valdría en absoluto.** Las personas
escogen "123456", "hospital2026" o el nombre del perro. Ese espacio es
pequeñísimo y está catalogado. Con SHA-256 sin sal:

- Dos usuarios con la misma contraseña tendrían el mismo hash, y se vería.
- Una rainbow table las revienta de inmediato.
- SHA-256 es **rápido a propósito**, y eso juega en contra: una GPU calcula
  miles de millones por segundo.

Para contraseñas hacen falta sal y una función **lenta a propósito**: bcrypt,
scrypt o Argon2. Eso es exactamente el Bloque 4 del Lab 7.

Resumiendo: el algoritmo no es bueno ni malo por sí solo. Depende de qué estoy
protegiendo. Secreto aleatorio largo → SHA-256 sirve. Secreto elegido por una
persona → no sirve.

---

# Las capas nuevas

Creé tres archivos y reescribí uno.

**`src/utils/crypto.util.js`**
Aísla lo criptográfico. Expone `generarHash` (SHA-256) y `compararSeguro`
(`timingSafeEqual`), y nadie más toca `crypto` directamente.

**`src/data/apiKeys.js`**
Simula la tabla que más adelante será `api_keys` en PostgreSQL. Valida que las
tres variables de entorno existan y expone los tres registros con su hash.

**`src/services/apiKeys.service.js`**
Expone `buscarClientePorApiKey`. Hashea lo que llega y lo compara contra los
registros hasta encontrar coincidencia, o devuelve `null`.

**`src/middlewares/apiKey.middleware.js`** (reescrito entero)
Ya no sabe nada de criptografía. Solo pide el cliente al service y decide qué
código HTTP devolver.

## El orden de dependencias

    app.js
      ↓
    apiKey.middleware.js
      ↓
    apiKeys.service.js
      ↓
    apiKeys.js  (data)
      ↓
    crypto.util.js

Va en una sola dirección, sin ciclos. Cada capa solo conoce a la de abajo.

Esto tiene una consecuencia práctica que me gustó: **`crypto.util.js` no sabe
que existen las API Keys**. Solo sabe hashear y comparar. Si mañana necesito
hashear otra cosa, lo reutilizo tal cual.

Y hay un detalle de limpieza. `compararSeguro` ya existía dentro del middleware
del Lab 5. Al moverla a `crypto.util.js` tenía la función duplicada en dos
sitios. Al reescribir el middleware la copia vieja desapareció. Lo verifiqué:

    grep -rn "const compararSeguro" src/
    src/utils/crypto.util.js:26

Una sola definición en todo el proyecto.

[Captura: el árbol de src/ con utils/, data/apiKeys.js y services/apiKeys.service.js]

---

# Los cuatro estados

El middleware nuevo distingue cuatro situaciones. Antes solo había dos.

| Situación | HTTP | Mensaje |
|---|---|---|
| No envía credencial | 401 | `API Key requerida` |
| Credencial inválida | 401 | `API Key inválida` |
| Credencial válida pero deshabilitada | **403** | `API Key deshabilitada` |
| Credencial válida y activa | 200 | — |

## La diferencia entre 401 y 403

Me costó un poco verla al principio, así que la escribo como la entendí.

**401 es "no sé quién eres".** O no me mandaste credencial, o la que me mandaste
no corresponde a ningún cliente que yo tenga registrado. No he conseguido
autenticarte.

**403 es "sé perfectamente quién eres, pero no pasas".** Tu clave hizo match con
el hash de la Aplicación Móvil. Te he identificado sin ninguna duda. Lo que pasa
es que ese cliente tiene `activa: false`.

En el 401 falla la autenticación. En el 403 la autenticación va bien y lo que
falla es la autorización. Son dos preguntas distintas: *¿quién eres?* y *¿te
dejo?*.

Y esto es justo lo que hace útil tener tres claves en vez de una. La Móvil está
fuera mientras Postman y Admin siguen entrando con normalidad. Eso con una clave
global era imposible.

## Las pruebas, sobre GET /api/pacientes

| Caso | Código | Cuerpo |
|---|---|---|
| Sin cabecera | **401** | `{"mensaje":"API Key requerida"}` |
| `X-API-Key: cualquier-cosa` | **401** | `{"mensaje":"API Key inválida"}` |
| Clave de Postman | **200** | 3 pacientes |
| Clave de Admin | **200** | 3 pacientes |
| Clave de Móvil | **403** | `{"mensaje":"API Key deshabilitada"}` |

Y comprobé que no rompí nada del Lab 5. Con clave válida:

    DELETE /api/medicos/1
    409 {"mensaje":"No se puede eliminar el médico porque tiene citas asociadas"}

La integridad referencial sigue intacta por debajo de la autenticación.

[Captura: los cinco casos en Postman, sobre todo el 403]

---

# El cambio de comportamiento que más me interesa

Este es el punto que creo que más vale del laboratorio.

**Antes (Lab 5).** El middleware comprobaba en cada petición si existía la
variable de entorno. Si faltaba, devolvía 500. El servidor arrancaba tan
tranquilo, el puerto abierto, `/` respondiendo 200, y sin embargo la API estaba
rota. Me enteraba cuando alguien se quejaba.

**Ahora (Lab 6).** Esa comprobación se mudó a `src/data/apiKeys.js`, que la hace
**una sola vez, al cargarse el módulo**.

Lo probé dejando `API_KEY_MOVIL=` vacía en `.env`:

    ◇ injected env (6) from .env
    C:\...\src\data\apiKeys.js:25
      throw new Error(
      ^

    Error: Faltan variables de entorno para las API Keys
        at Object.<anonymous> (src/data/apiKeys.js:25:9)
        at Module._compile (node:internal/modules/cjs/loader:1830:14)
        at Object..js (node:internal/modules/cjs/loader:1961:10)
        at Module.load (node:internal/modules/cjs/loader:1553:32)

**Exit code: 1.**

Y comprobé que el puerto nunca llegó a abrir:

    curl http://localhost:3000/  →  000 (sin conexión)

El proceso muere durante la carga de módulos, antes de llegar al `app.listen`.

## Por qué esto es mejor

Es el principio de *fail fast*: mejor no arrancar que arrancar mal.

El argumento que más me convence es el del **health check**. En un despliegue
real, el orquestador levanta el contenedor y le pregunta si está vivo.

Con el comportamiento viejo, el contenedor arrancaba, respondía al health check
que sí, entraba en el balanceador, recibía tráfico de verdad y devolvía 500 a
todos los clientes. Un fallo de configuración se convertía en una caída en
producción.

Con el comportamiento nuevo, el contenedor ni siquiera arranca. No pasa el
health check, no entra al balanceador, no recibe una sola petición de cliente.
La versión anterior sigue sirviendo mientras yo arreglo el `.env`.

Además el fallo es **ruidoso y una sola vez**, no silencioso y repetido. Un
error en el arranque se ve enseguida en los logs. Un 500 por petición se pierde
entre el ruido.

Después de la prueba restauré el `.env` desde una copia y volví a verificar:
401 / 200 / 200 / 403. Todo correcto.

[Captura: la terminal con el stack trace y el proceso muriendo]

---

# El endpoint que lo demuestra todo

Creé `src/routes/seguridad.routes.js` con una sola ruta:

    GET /api/seguridad/cliente

Devuelve `req.clienteApi`, que es lo que el middleware adjunta a la petición
cuando la clave es válida y está activa:

    req.clienteApi = {
      id: cliente.id,
      nombre: cliente.cliente
    };

## La prueba de la PARTE 16

**La URL es exactamente la misma en las cuatro.** Lo único que cambia es la
cabecera `X-API-Key`.

Con la clave de Postman Laboratorio — **200**:

    {"mensaje":"Cliente autenticado","cliente":{"id":1,"nombre":"Postman Laboratorio"}}

Con la clave de Aplicación Administrativa — **200**:

    {"mensaje":"Cliente autenticado","cliente":{"id":2,"nombre":"Aplicación Administrativa"}}

Con la clave de Aplicación Móvil — **403**:

    {"mensaje":"API Key deshabilitada"}

Sin cabecera — **401**:

    {"mensaje":"API Key requerida"}

Mismo método, misma ruta, y el servidor responde `id: 1` o `id: 2` según quién
pregunte. Eso es lo que no podía hacer con una clave global.

La Móvil ni siquiera llega al endpoint. La corta el middleware antes.

[Captura: Swagger autorizado con la clave de Postman, respuesta con id 1]
[Captura: Swagger reautorizado con la clave de Admin, respuesta con id 2]

---

# app.js y Swagger casi no cambiaron

Esto me pareció la mejor señal de que la arquitectura está bien separada.

**En `app.js`** solo añadí dos cosas: el `require` del router nuevo y su
montaje.

    app.use("/api/seguridad", seguridadRoutes);

Nada más. No hizo falta tocar el montaje del middleware, porque desde el Lab 5
ya estaba:

    app.use("/api", validarApiKey);

Como la ruta nueva cuelga de `/api`, **queda protegida sola**. Las pruebas del
403 y el 401 sobre `/api/seguridad/cliente` lo confirman.

Y lo más llamativo: `app.js` **no se enteró** de que pasé de una clave a tres.
No sabe nada de hashes, ni de clientes, ni de `activa`. Solo sabe que hay un
middleware llamado `validarApiKey` montado en `/api`. Toda la lógica nueva vive
por debajo.

**En Swagger** solo añadí el tag `Seguridad`. El `securitySchemes` del Lab 5
sigue igual:

    ApiKeyAuth:
      type: "apiKey"
      in: "header"
      name: "X-API-Key"

A Swagger le da igual si por dentro tengo 1 clave, 3 o 300. Lo único que
necesita documentar es que el cliente debe mandar una API Key por esa cabecera.

## Comprobación del spec

Comparé `/openapi.json` antes y después, porque no quería perder nada:

    paths     : 14 -> 15
    endpoints : 34 -> 35
    schemas   : 16 -> 16
    tags      :  5 -> 6

    schemas PERDIDOS   : NINGUNO
    endpoints PERDIDOS : NINGUNO
    tags PERDIDOS      : NINGUNO
    schemas alterados  : NINGUNO

    endpoints NUEVOS   : ('/api/seguridad/cliente', 'get')
    tags NUEVOS        : ['Seguridad']

La ruta nueva quedó documentada con `tags: ['Seguridad']`, summary, description
y `responses: ['200', '401', '403']`.

**35 endpoints en total.**

---

# Semgrep y npm audit repetidos

Los volví a correr para ver si metí algo malo.

**Semgrep**, mismo comando de siempre:

    semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/

    Ran 73 rules on 34 files: 0 findings.

Pasó de **30 a 34 archivos**. Los cuatro nuevos son `crypto.util.js`,
`apiKeys.js`, `apiKeys.service.js` y `seguridad.routes.js`. 30 + 4 = 34.
Cuadra exactamente.

**npm audit**:

    found 0 vulnerabilities

Las mismas 8 dependencias de siempre. Y confirmé que `crypto` no se instaló:

    crypto en dependencies?                              False
    existe node_modules/crypto?                          NO
    require('module').builtinModules.includes('crypto')  true

`crypto` viene con Node. Si hubiera hecho `npm install crypto` me habría bajado
un paquete abandonado del registro que no es el módulo real.

Evidencias: `sast-semgrep-lab6.txt` y `sca-npm-audit-lab6.txt`. No borré las
anteriores.

[Captura: la salida de Semgrep con los 34 archivos]

---

# El README: no había que actualizarlo, había que escribirlo

Cuando fui a actualizar el README me encontré con que las secciones que quería
tocar **no existían**.

No había tabla de variables de entorno. No había tabla de endpoints. No había
tabla de códigos de respuesta. No había sección de autenticación. El README era
el guion de montaje del proyecto —instalar express, crear el `.env`, copiar el
`src`— pero no documentaba cómo se usa la API.

Así que las creé desde cero:

- Tabla de variables de entorno, con las tres claves marcadas como obligatorias
- Sección de autenticación por API Key, con los tres clientes y el hash
- Tabla de códigos de respuesta, ahora con el 403
- Tabla con los 35 endpoints
- Apartado explicando que un fallo de configuración impide arrancar

Pasó de 171 a 307 líneas.

**Y el árbol de estructura estaba desactualizado desde el Lab 5.** Le faltaba
`apiKey.middleware.js`, que había creado en ese laboratorio y nunca añadí al
README. Ahora le faltaban además los cuatro archivos de este. Lo puse al día
entero: `utils/`, `data/apiKeys.js`, `services/apiKeys.service.js`,
`routes/seguridad.routes.js` y el `apiKey.middleware.js` que llevaba un
laboratorio perdido.

Lección: la documentación se desactualiza en silencio. Nada falla, nada avisa.
Solo te das cuenta cuando vas a mirarla.

---

# La distinción de la PARTE 17

Esta parte es importante para no venderme más de lo que tengo.

Ahora mismo sé esto:

    API KEY
       ↓
    "Aplicación Administrativa"

Eso **no** significa:

    "Juan Pérez, administrador"

Lo que sé es **qué aplicación** consume mi API. No sé **qué persona** está
detrás usando esa aplicación.

Si tres personas distintas usan la Aplicación Administrativa, las tres llegan a
mi API con la misma API Key y yo las veo exactamente igual. No puedo
distinguirlas, ni auditar quién hizo qué, ni darle permisos distintos a una que
a otra.

La API Key identifica al **cliente software**, no al usuario.

Para saber qué persona entra hace falta otra capa entera:

    API KEY          → ¿qué aplicación consume la API?
         +
    USUARIO + CONTRASEÑA → ¿qué persona está ingresando?
         ↓
    JWT              → prueba temporal de autenticación
         ↓
    ROL              → administrador / médico / paciente
         ↓
    AUTORIZACIÓN

Eso es el Lab 7, Bloque 4: usuarios, hashing y salting. Y ahí es donde SHA-256
sin sal deja de servir, por lo que expliqué arriba.

---

# Corrección al informe del Laboratorio 5

Tenía una idea equivocada sobre cómo Semgrep elige los archivos, y la aclaro
aquí porque afecta a cómo se leen los conteos de los dos informes.

**Lo que creía:** que Semgrep solo escanea archivos registrados en git, y que
por eso un archivo nuevo sin commit se quedaría fuera del escaneo.

**Lo que pasa de verdad:** Semgrep no exige que un archivo esté commiteado. Lo
que hace es **excluir lo que está en `.gitignore`**. Un archivo nuevo, sin
commit, se escanea igual mientras no esté ignorado.

Lo confirma el conteo de este laboratorio. Los cuatro archivos que creé
—`crypto.util.js`, `apiKeys.js`, `apiKeys.service.js` y `seguridad.routes.js`—
no tenían commit de ningún tipo, y aun así el escaneo pasó de **30 a 34
archivos**. Si mi idea hubiera sido correcta, se habría quedado en 30.

Y hay un dato que lo cierra del todo: **este proyecto ni siquiera es un
repositorio git**. Lo comprobé:

    git rev-parse --is-inside-work-tree
    fatal: not a git repository (or any of the parent directories): .git

No hay `.git` en ninguna parte. Así que no existe nada "registrado en git" aquí,
y sin embargo los 34 archivos `.js` de `src/` se escanearon, que son
exactamente todos los que hay.

**De dónde viene la confusión:** de la propia herramienta. Semgrep imprime en
cada ejecución una línea que dice:

    Scanning 34 files tracked by git with 563 Code rules

"tracked by git" suena a "solo los que están en git". Pero lo imprime siempre,
incluso —como aquí— cuando no hay repositorio git de ninguna clase. Es un
mensaje genérico, no una descripción de lo que hizo.

**Qué significa esto para lo que ya hice:** nada se quedó sin escanear en
ninguno de los dos laboratorios. Todos los conteos de los informes son válidos.
Si en algún momento escaneé un archivo por separado por miedo a que se quedara
fuera, ese escaneo no sobraba, simplemente era **redundante**: ese archivo ya
entraba en el escaneo general de `src/`.

Lo que sí hay que vigilar de verdad es el `.gitignore`. Si algún día meto ahí
una carpeta de código propio, Semgrep dejará de mirarla sin decir nada. Hoy solo
tiene `node_modules/` y `.env`, y ninguno de los dos es código mío que quiera
analizar.

---

# Resumen

| Antes (Lab 5) | Ahora (Lab 6) |
|---|---|
| 1 clave global | 3 clientes con clave propia |
| Clave en claro en `.env` y en memoria | Solo el hash SHA-256 en memoria |
| No sabía quién pedía | `req.clienteApi` con id y nombre |
| Revocar = romperlo para todos | Revocar uno solo con `activa: false` |
| 2 estados (401 / 200) | 4 estados (401 / 401 / 403 / 200) |
| Falta de config → 500 por petición | Falta de config → el servidor no arranca |
| 34 endpoints | 35 endpoints |

# Archivos de evidencia

| Archivo | Qué contiene |
|---|---|
| `sast-semgrep-lab6.txt` | Semgrep tras el Lab 6, 34 archivos, 0 hallazgos |
| `sca-npm-audit-lab6.txt` | npm audit y npm ls tras el Lab 6 |
| `informe-lab5-hospital.md` | Informe del laboratorio anterior |

# Pendiente

Llevar los tres bloques al proyecto de mi equipo, con documentación y acceso al
repositorio, como pide el entregable de la PARTE 17.
