# Laboratorio No. 5 — API_HOSPITAL

Bloques 1, 2 y 3 aplicados al proyecto de referencia.
Fecha: 20 de septiembre de 2026.

Este documento resume qué hicimos, qué probamos y qué salió.
Las evidencias completas están en los demás archivos de `docs/seguridad/`.

---

# BLOQUE 1 — Integridad referencial

## El problema

Los datos viven en memoria, en archivos `.js`. No hay base de datos.
Eso quiere decir que nada impide hacer esto:

    DELETE /api/medicos/1

aunque exista una cita que apunta a ese médico:

    { "medicoId": 1 }

Si borramos el médico, la cita se queda apuntando a alguien que ya no existe.
Eso es un **registro huérfano**.

En PostgreSQL esto lo resolvería la base de datos sola:

    FOREIGN KEY (...) REFERENCES ... ON DELETE RESTRICT

Como todavía no tenemos base de datos, lo implementamos a mano en los services.

## Las reglas

| Intento | Condición | Resultado |
|---|---|---|
| Eliminar paciente | Tiene citas | 409 |
| Eliminar médico | Tiene citas | 409 |
| Eliminar consultorio | Tiene citas | 409 |
| Eliminar especialidad | Tiene médicos | 409 |
| Eliminar cualquiera | Sin relaciones | 200 |

## Las funciones nuevas

En `src/services/medicos.service.js`:

    const especialidadTieneMedicos = (especialidadId) => {
      return medicos.some(
        medico =>
          medico.especialidadId === Number(especialidadId)
      );
    };

En `src/services/citas.service.js`, bajo un comentario de bloque
`// Integridad referencial`, tres más:

    pacienteTieneCitas(pacienteId)
    medicoTieneCitas(medicoId)
    consultorioTieneCitas(consultorioId)

Las tres usan `citas.some(...)` y las cuatro se agregaron al `module.exports`.

**Ojo con esto:** ninguna de las tres filtra por estado.
Una cita cancelada sigue contando.
Sigue siendo un registro histórico, así que el paciente no se puede borrar.

No hay que confundirlas con `medicoTieneConflicto()` ni
`consultorioTieneConflicto()`, que ya existían y responden otra pregunta:

- `medicoTieneConflicto()` → ¿tiene una cita **en esta fecha y hora**?
- `medicoTieneCitas()` → ¿tiene **cualquier** cita?

## El orden en los controllers

Los cuatro DELETE siguen el mismo orden. Primero existencia, después relaciones,
después borrar:

    1. ¿Existe?        NO -> 404
    2. ¿Tiene relaciones?  SÍ -> 409
    3. Borrar          -> 200

Archivos tocados:

- `especialidades.controller.js` → importa `medicos.service`
- `pacientes.controller.js` → importa `citas.service`
- `medicos.controller.js` → importa `citas.service`
- `consultorios.controller.js` → importa `citas.service`

## ¿Por qué 409 y no 400?

Porque la petición está bien hecha.
El id es válido. El recurso existe.
El problema es el estado del sistema, no la petición.

    400 -> la petición o los datos están mal
    404 -> el recurso no existe
    409 -> la petición es válida pero choca con el estado actual

## Checkpoint 1 — los siete puntos

| | Prueba | Esperado | Obtenido |
|---|---|---|---|
| ✅ | DELETE paciente con citas | 409 | 409 |
| ✅ | DELETE médico con citas | 409 | 409 |
| ✅ | DELETE consultorio con citas | 409 | 409 |
| ✅ | DELETE especialidad con médicos | 409 | 409 |
| ✅ | DELETE recurso sin relaciones | 200 | 200 |
| ✅ | DELETE id inexistente | 404 | 404 |
| ✅ | DELETE id inválido | 400 | 400 |

Respuestas literales:

    DELETE /api/pacientes/1      -> 409
    {"mensaje":"No se puede eliminar el paciente porque tiene citas asociadas"}

    DELETE /api/medicos/1        -> 409
    {"mensaje":"No se puede eliminar el médico porque tiene citas asociadas"}

    DELETE /api/consultorios/2   -> 409
    {"mensaje":"No se puede eliminar el consultorio porque tiene citas asociadas"}

    DELETE /api/especialidades/2 -> 409
    {"mensaje":"No se puede eliminar la especialidad porque tiene médicos asociados"}

Para el caso 200 creamos una especialidad nueva (Neurología, id 5) y la
borramos enseguida. Como no tenía médicos, dio 200.

El 404 y el 400 los probamos en los cuatro recursos, no solo en uno:

    /999 -> 404 en pacientes, medicos, consultorios y especialidades
    /abc -> 400 en los cuatro

El 400 lo corta el validator antes de llegar al controller.

---

# BLOQUE 2 — Auditoría: SCA + SAST + DAST

## SCA — npm audit

Revisa vulnerabilidades conocidas en las dependencias. No necesita la API
corriendo.

Salida literal:

    === npm audit ===
    Sun Sep 20 08:47:44 HPS 2026

    found 0 vulnerabilities

    exit code: 0

`npm audit fix` no tuvo nada que corregir:

    up to date, audited 120 packages in 1s
    found 0 vulnerabilities

Las 8 dependencias directas (`npm ls --depth=0`):

    cors@2.8.6
    dotenv@18.0.1
    express@5.2.1
    express-rate-limit@8.7.0
    express-validator@7.3.2
    helmet@8.3.0
    swagger-jsdoc@6.3.0
    swagger-ui-express@5.0.1

Evidencia: `sca-npm-audit.txt` y `sca-npm-ls.txt`.

## SAST — Semgrep

Analiza nuestro propio código. Tampoco necesita la API corriendo.

Comando:

    semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/

Salida literal:

    ┌──────────────┐
    │ Scan Summary │
    └──────────────┘
    ✅ Scan completed successfully.
     • Findings: 0 (0 blocking)
     • Rules run: 73
     • Targets scanned: 29
     • Parsed lines: ~100.0%
     • No ignore information available
    Ran 73 rules on 29 files: 0 findings.

Descargó 563 reglas, de las cuales 73 aplican a este código.

Evidencia: `sast-semgrep.txt`.

## SAST — revisión manual

Semgrep no encuentra nada, pero las reglas automáticas no saben nada de nuestras
reglas de negocio. Así que revisamos cinco cosas a mano.

**1. `req.body` sin `matchedData`**

    grep -rn "req\.body" src/

Cero ocurrencias en todo `src/`. Los cinco controllers usan solo
`matchedData(req)`, que devuelve únicamente los campos que el validator declaró.
Por eso un `id` o un `estado` inyectados en el cuerpo nunca llegan al service.

**2. Concatenación de entrada del usuario**

Buscamos template literals con datos del cliente, y `eval`, `new Function`,
`child_process`, `exec`. Nada.

La única interpolación con dato del cliente es el mensaje de la máquina de
estados, y los dos valores vienen de un enum cerrado.

**3. Secretos en el código**

Cero secretos escritos a mano. Solo dos lecturas de entorno:
`process.env.PORT` y `process.env.ALLOWED_ORIGIN`.

**4. Información sensible en los errores**

El handler global manda el error a `console.error` (servidor) y al cliente solo
le responde:

    { "mensaje": "Error interno del servidor" }

Nunca devuelve el stack. Además `x-powered-by` está deshabilitado y helmet
está montado.

Anotamos una cosa menor: `validar.middleware.js` devuelve el array de errores
de express-validator entero, y eso incluye el campo `value` con lo que mandó el
cliente. Hoy no filtra nada porque solo hace eco de su propia entrada. Pero en
el Bloque 4, cuando haya contraseñas, ahí sí mostraría el secreto.

**5. Endpoints sin validación**

Las 34 operaciones que reciben algo tienen validator + `validar`.
Los únicos sin validator son los 5 GET de colección, que no reciben nada.

Evidencia: `sast-revision-manual.md`.

## El rate limit estaba fijo en el código

Antes de poder escanear nos topamos con esto en `src/app.js`:

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      ...
    });

100 peticiones cada 15 minutos sobre todo `/api`, escrito a mano en el código.
Un Active Scan de ZAP sobre 34 endpoints manda miles de peticiones. A partir de
la 101 todo sale 429 y el reporte se llena de falsos negativos.

Lo parametrizamos:

    const RATE_LIMIT_MAX =
      Number(process.env.RATE_LIMIT_MAX) || 100;

    limit: RATE_LIMIT_MAX,

Y en `.env` y `.env.example`:

    RATE_LIMIT_MAX=100

Lo hicimos por variable de entorno y no editando el código a mano, porque el
cambio en el código es el que se queda olvidado en el repositorio y deja la API
sin protección. Así se sube solo para el escaneo:

    RATE_LIMIT_MAX=100000 npm run dev

Al cerrar la terminal vuelve a 100.

Lo comprobamos:

| Modo | Peticiones | 200 | 429 |
|---|---|---|---|
| `npm run dev` | 110 | 97 | 13 (el primero en la nº 101 contando todas) |
| `RATE_LIMIT_MAX=100000 npm run dev` | 150 | 150 | 0 |

Detalle: en modo normal el arranque dice `injected env (3) from .env`, y con el
override dice `injected env (2)`. Es porque dotenv no pisa una variable que ya
existe en `process.env`. Gana la de la terminal, que es lo que queríamos.

## DAST — OWASP ZAP

`/openapi.json` responde 200, con 14 rutas y 34 endpoints.

Armamos un plan de automatización en `dast-zap-plan.yaml`:

    openapi -> passiveScan-wait -> activeScan -> passiveScan-wait -> 3 reportes

Se lanza así:

    cd "C:\Program Files\ZAP\Zed Attack Proxy"
    .\zap.bat -cmd -autorun "<ruta-del-proyecto>\docs\seguridad\dast-zap-plan.yaml"

Las rutas del plan son relativas al directorio del plan, así que los reportes
caen en `docs/seguridad/` aunque ZAP se lance desde otra carpeta.

### Los dos escaneos

Corrimos ZAP dos veces.

**Escaneo 1 — 09:15:31, antes de la API Key.**
Reportes: `dast-zap-reporte.html`, `.json`, `.md`.

**Escaneo 2 — 09:35:21, con la API Key ya montada.**
Reportes: `dast-zap-reporte-bloque3.html`, `.json`, `.md`.

Los dos dan lo mismo:

    Alto: 0 | Medio: 0 | Bajo: 0 | Informativo: 0

    Percentage of responses with status code 2xx : 2 %
    Percentage of responses with status code 4xx : 97 %
    Count of total endpoints                     : 35

ZAP sí importó el OpenAPI. Ve los 35 endpoints (los 34 de `/api` más la raíz).
Pero el 97% de las respuestas fueron 4xx en los dos casos, por motivos
distintos.

**El escaneo 2 no es un escaneo fallido.**
Es la demostración de que la protección funciona.
Con la API Key montada, ZAP no manda la cabecera `X-API-Key`, así que todo
`/api` le responde 401 y no consigue atacar nada. Un atacante automatizado sin
la clave se queda exactamente igual. Eso es lo que queríamos ver.

**El escaneo 1 sí hay que matizarlo, para no decir algo falso.**
Se lanzó un minuto antes de crear el middleware de la API Key, así que sus 4xx
no eran 401. Eran 429: el servidor estaba corriendo en modo normal, con el
límite en 100 peticiones cada 15 minutos, y el Active Scan se lo comió en
segundos. Por eso también salieron 0 alertas.

O sea: todavía **no tenemos un escaneo válido de la API sin proteger**.
Para conseguirlo falta repetirlo levantando la API con
`RATE_LIMIT_MAX=100000` y, si se quiere escanear por detrás de la API Key,
añadirle al plan la cabecera `X-API-Key`.

Evidencia: `dast-preparacion.md` y los seis archivos de reporte.

## Pruebas manuales de lógica de negocio

Estas son las que ni npm audit, ni Semgrep, ni ZAP iban a encontrar. Son las
cinco que pide el PDF.

**1. Crear una cita que nazca "atendida"**

    POST /api/citas
    {..., "estado":"atendida"}

    -> 201, y la cita nace "programada"

El `estado` se descarta. El validator no lo declara en la creación, el
controller lee con `matchedData` y el service fija el estado.
**Ya estaba controlado.**

**2. Pasar una cita de "atendida" a "programada"**

    PATCH /api/citas/4/estado
    {"estado":"programada"}

    -> 409
    {"mensaje":"No se permite cambiar una cita de atendida a programada"}

Hay una máquina de estados explícita:

    programada  -> [confirmada, cancelada]
    confirmada  -> [atendida, cancelada]
    atendida    -> []
    cancelada   -> []

`atendida` y `cancelada` son terminales. **Ya estaba controlado.**

**3. Asignar una cita a un médico inactivo**

Los tres médicos del seed están activos, así que creamos uno con
`"activo": false` (id 4).

    POST /api/citas con medicoId 4
    -> 409
    {"mensaje":"No se pueden programar citas con un médico inactivo"}

**Ya estaba controlado.**

**4. Ocupar dos veces el mismo consultorio en la misma fecha y hora**

La cita 1 ya ocupa el consultorio 2 el 2026-09-15 a las 10:30.

    POST /api/citas con consultorioId 2, misma fecha y hora
    -> 409
    {"mensaje":"El consultorio ya está ocupado en esa fecha y hora"}

Probamos también la variante del médico:

    -> 409
    {"mensaje":"El médico ya tiene una cita programada en esa fecha y hora"}

**Ya estaba controlado.**

**5. Modificar campos no permitidos**

    PUT /api/citas/3
    {"id":999, "estado":"atendida", ...}

    -> 200, pero el id sigue siendo 3 y el estado sigue siendo "programada"

Igual con PATCH, y también en otro recurso:

    PATCH /api/pacientes/2 {"id":777, "telefono":"3009998877"}
    -> 200, id sigue siendo 2, solo cambió el teléfono

**Ya estaba controlado.** `matchedData` filtra, y los services reconstruyen el
objeto conservando `id` y `estado` en vez de hacer spread del cuerpo.

### Resumen

Las cinco estaban controladas. No hubo que arreglar nada.

Evidencia: `pruebas-logica-negocio.md`.

## Checkpoint Bloque 2

| | Ítem | Estado |
|---|---|---|
| ✅ | npm audit ejecutado | 0 vulnerabilidades |
| ✅ | Semgrep ejecutado | 0 hallazgos |
| ✅ | API levantada | localhost:3000 |
| ✅ | /openapi.json funcionando | 200, 34 endpoints |
| ✅ | OpenAPI importado en ZAP | 35 endpoints vistos |
| ✅ | Passive Scan revisado | 0 alertas |
| ⚠️ | Active Scan realizado | Corrido dos veces, pero ninguno concluyente (ver arriba) |
| ✅ | Mass assignment probado | Prueba 5 |
| ✅ | Máquina de estados probada | Pruebas 1 y 2 |
| ✅ | Doble reserva probada | Prueba 4 |
| ✅ | DELETE protegido probado | Los cuatro dan 409 |

---

# BLOQUE 3 — Protección con API Key

## Generar la clave

No inventamos una clave a mano. Node trae un generador criptográfico:

    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Salen 32 bytes en hexadecimal, o sea 64 caracteres.

## .env frente a .env.example

En `.env` va la clave de verdad:

    # Clave requerida para consumir los endpoints protegidos de /api
    API_KEY=<la clave real de 64 caracteres>

En `.env.example` va la misma línea pero sin la clave:

    # Clave requerida para consumir los endpoints protegidos de /api
    API_KEY=REEMPLAZAR_CON_API_KEY_SEGURA

`.env.example` sí puede ir al repositorio. Sirve para que otro sepa qué
variables necesita, sin darle el secreto.

`.env` está en `.gitignore`, lo comprobamos.

## El middleware

Creamos `src/middlewares/apiKey.middleware.js` con dos funciones.

`compararSeguro(valorRecibido, valorEsperado)` compara los dos valores como
buffers. Si tienen distinta longitud devuelve false directamente, porque
`timingSafeEqual` exige buffers del mismo tamaño.

`validarApiKey(req, res, next)` hace tres comprobaciones:

    1. ¿Está configurada API_KEY en el servidor?   NO -> 500
    2. ¿Vino la cabecera X-API-Key?                NO -> 401 "API Key requerida"
    3. ¿Coincide?                                  NO -> 401 "API Key inválida"
                                                   SÍ -> next()

## ¿Por qué timingSafeEqual y no ===?

Porque `===` compara carácter por carácter y **para en cuanto encuentra una
diferencia**. Eso significa que una clave que falla en el carácter 30 tarda un
poquito más que una que falla en el carácter 2.

Esa diferencia de tiempo es medible. Un atacante puede ir probando y, mirando
cuánto tarda la respuesta, deducir la clave carácter a carácter. Eso es un
**timing attack**.

`crypto.timingSafeEqual()` compara todos los bytes siempre, tarde lo que tarde.
El tiempo de respuesta no dice nada sobre el contenido.

## Dónde se monta

En `src/app.js`, después del rate limiter y antes de las rutas de `/api`:

    app.use("/api", limiter);

    // ========================================
    // Autenticación mediante API Key
    // ========================================

    app.use("/api", validarApiKey);

El flujo queda así:

    REQUEST -> Helmet -> CORS -> JSON Parser -> Rate Limiter -> API Key
            -> Routes -> Validators -> Controllers -> Services

Montarlo en `/api` y no globalmente tiene una consecuencia: `/`, `/api-docs` y
`/openapi.json` siguen abiertos. Eso es lo que dice el PDF para esta fase.

No pusimos ningún `console.log` de la clave ni la devolvemos en ninguna
respuesta. Lo verificamos: la clave no aparece en el log de arranque.

## Pruebas

| Caso | Código | Respuesta |
|---|---|---|
| Sin cabecera | 401 | `{"mensaje":"API Key requerida"}` |
| Cabecera incorrecta | 401 | `{"mensaje":"API Key inválida"}` |
| Cabecera correcta | 200 | 3 pacientes |
| `?apiKey=LA_CLAVE` en la query | 401 | `{"mensaje":"API Key requerida"}` |
| `GET /` | 200 | `{"mensaje":"API Hospital funcionando"}` |
| `GET /api-docs` | 200 | Swagger UI |
| `GET /openapi.json` | 200 | 22294 bytes |
| Con clave, `DELETE /api/medicos/1` | 409 | Sigue la integridad referencial |

Lo de la query string es a propósito. El middleware solo mira
`req.get("X-API-Key")`, nunca `req.query.apiKey`. Es mejor así porque las URLs
se quedan registradas en historiales, logs y proxies. Un secreto en la URL es un
secreto filtrado.

Añadimos tres pruebas que el PDF no pide:

- `DELETE /api/medicos/1` **sin** clave da **401**, no 409. O sea que la
  autenticación corta antes de llegar a la lógica de negocio.
- Una clave incorrecta de **la misma longitud** (64 hex) da 401. Esto obliga a
  pasar por `timingSafeEqual` de verdad, no por el atajo de la longitud.
- La clave real con **un solo carácter cambiado** da 401.

## Swagger con securitySchemes

En `src/docs/swagger.js`, dentro de `definition`, agregamos:

    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "API Key requerida para consumir los endpoints protegidos."
        }
      }
    },

    security: [
      { ApiKeyAuth: [] }
    ],

Esto hace que Swagger UI muestre el botón **Authorize** y los candados.

Antes de darlo por bueno comparamos `/openapi.json` antes y después, porque los
16 schemas del spec vienen de los comentarios `@openapi` de las rutas y había
riesgo de que el `components` nuevo los pisara:

    paths      : 14 -> 14
    endpoints  : 34 -> 34
    schemas    : 16 -> 16

    schemas perdidos  : NINGUNO
    schemas alterados : NINGUNO

No se perdió nada. `swagger-jsdoc` hace merge profundo de `components`.

Pruebas en Swagger:

- Sin autorizar, `GET /api/pacientes` da 401
- Autorizando con la clave real, 200
- Tras Logout, 401 otra vez
- Autorizado, `POST /api/pacientes` da 201
- Sin autorizar, el mismo POST con otro documento da 401

Y lo importante del último caso: después del POST rechazado la lista sigue
teniendo 4 pacientes. El paciente no se creó. La petición sin autorizar ni
siquiera llegó al código de creación.

## Semgrep y npm audit otra vez

Repetimos los dos para ver si el bloque metió algo malo.

Semgrep, ahora sobre 30 archivos en vez de 29 (el nuevo es el middleware):

    Ran 73 rules on 30 files: 0 findings.

npm audit:

    found 0 vulnerabilities

Y confirmamos que **no se instaló ninguna dependencia nueva**:

    crypto en dependencies?                              False
    existe node_modules/crypto?                          NO
    require('module').builtinModules.includes('crypto')  true

`crypto` viene con Node. Si hubiéramos hecho `npm install crypto` nos habríamos
bajado un paquete abandonado del registro que no es el módulo real.

Evidencia: `sast-semgrep-bloque3.txt` y `sca-npm-audit-bloque3.txt`.

## Checkpoint Bloque 3A

| | Ítem | Esperado | Obtenido |
|---|---|---|---|
| ✅ | Sin X-API-Key | 401 | 401 |
| ✅ | X-API-Key incorrecta | 401 | 401 |
| ✅ | X-API-Key correcta | 200 | 200 |
| ⚠️ | Swagger + Authorize | 200 | 200 a nivel HTTP; falta confirmar el botón en pantalla |
| ✅ | API Key en query string | 401 | 401 |
| ✅ | DELETE protegido + API Key | 409 | 409 |
| ✅ | Semgrep | Sin nuevos hallazgos inesperados | 0 findings, igual que antes |

---

# Cosas que nos encontramos por el camino

Tres cosas que no estaban en el guion.

## 1. El proyecto venía sin package.json

El zip de API_HOSPITAL trae `src/`, el `.env`, el `.env.example`, el
`.gitignore` y el README. Pero no trae `package.json` ni `node_modules`.

Sin eso no arranca. Tuvimos que crear el `package.json` (con los scripts
`start` y `dev`) e instalar las 8 dependencias que el código requiere, siguiendo
lo que el propio README documenta:

    npm install express express-validator helmet cors express-rate-limit dotenv swagger-jsdoc swagger-ui-express

Después de instalarlas, `npm audit` dio 0 vulnerabilidades.

## 2. El module.exports del PDF no coincide con el proyecto

En la página 3, el PDF muestra cómo queda el `module.exports` de
`medicos.service.js` y lista estos dos nombres:

    buscarPorRegistroMedico,
    buscarPorEmail,

Pero en el proyecto esas funciones se llaman:

    buscarMedicoPorRegistro,
    buscarMedicoPorEmail,

Si lo copiábamos literal, se rompía el import de los controllers.
Dejamos los nombres reales del proyecto y solo insertamos
`especialidadTieneMedicos` en la posición que indica el PDF.

Detalle parecido: los `require` del PDF salen con un espacio de más,
`require(" ../services/citas.service")`. Es un artefacto del PDF. Tal cual no
resuelve el módulo, así que los escribimos sin el espacio.

## 3. El hallazgo de CSRF que el PDF anticipa no aparece

En la parte 3S el PDF dice que al repetir Semgrep "el hallazgo de CSRF puede
seguir apareciendo".

A nosotros no nos aparece. Ni antes ni después del Bloque 3.

El motivo es el comando. El PDF en esa parte usa:

    semgrep scan --config auto src

y nosotros usamos el que pide el Bloque 2:

    semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/

Son conjuntos de reglas distintos. Con los tres nuestros se descargan 563 reglas
y solo 73 aplican a este código, y ninguna de esas 73 detecta lo de CSRF.
No es que el proyecto esté mejor ni peor. Es que estamos mirando con otra lupa.

---

# Estado final del proyecto

La API ya no es solo una API REST. Ahora tiene, por capas:

    validación
    + rate limiting (parametrizable)
    + API Key
    + reglas de negocio
    + integridad referencial

Eso es **defensa en profundidad**. Cada capa tapa algo distinto, y la API Key
no reemplaza a las demás: con clave válida, borrar un médico con citas sigue
dando 409.

# Lo que queda pendiente

1. **Un escaneo de ZAP concluyente.** Repetirlo con
   `RATE_LIMIT_MAX=100000 npm run dev`, y para escanear por detrás de la API Key,
   añadirle al plan la cabecera `X-API-Key`.
2. **Ver el botón Authorize en pantalla.** Abrir `http://localhost:3000/api-docs`
   y confirmarlo.
3. **Llevar los tres bloques al proyecto integrador del equipo.** El PDF dice
   desde la primera página que API_HOSPITAL es el insumo de referencia y que
   todo esto hay que aplicarlo al proyecto de cada equipo.

# Archivos de evidencia

| Archivo | Qué contiene |
|---|---|
| `sca-npm-audit.txt` | npm audit y npm audit fix del Bloque 2 |
| `sca-npm-ls.txt` | Dependencias directas |
| `sast-semgrep.txt` | Semgrep del Bloque 2 |
| `sast-revision-manual.md` | Revisión manual de los cinco puntos |
| `dast-preparacion.md` | /openapi.json, rate limit y preparación de ZAP |
| `dast-zap-plan.yaml` | Plan de automatización de ZAP |
| `dast-zap-reporte.*` | Escaneo 1, antes de la API Key |
| `dast-zap-reporte-bloque3.*` | Escaneo 2, con la API Key |
| `pruebas-logica-negocio.md` | Las cinco pruebas manuales |
| `sast-semgrep-bloque3.txt` | Semgrep repetido tras el Bloque 3 |
| `sca-npm-audit-bloque3.txt` | npm audit repetido tras el Bloque 3 |
