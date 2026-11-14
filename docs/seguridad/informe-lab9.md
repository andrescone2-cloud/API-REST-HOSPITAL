# Laboratorio No. 9 — API_HOSPITAL

BLOQUE 5 — Autenticación con JWT.
Fecha: 2 de octubre de 2026.

Hasta el Lab 8 el login solo decía "credenciales correctas" y ahí se acababa
todo. En este laboratorio empieza a entregar una credencial temporal.

---

# El problema: el login no dejaba rastro

Al terminar el Lab 8 teníamos esto:

    X-API-Key          -> ¿qué aplicación consume la API?
    email + password   -> ¿las credenciales son correctas?

Y ahí se acababa. El login respondía 200 y punto. La siguiente petición no sabía
nada del que acababa de entrar: había que mandar email y contraseña otra vez en
cada llamada, o no saber quién era.

Lo dejamos escrito como la segunda limitación del Lab 7: *no hay token*.

## La manilla del concierto

La metáfora del PDF nos sirvió para entenderlo. En la entrada de un concierto el
organizador comprueba tu entrada **una vez** y te pone una manilla. A partir de
ahí nadie vuelve a pedirte la entrada: miran la manilla.

| JWT | Concierto |
|---|---|
| Payload | Lo que lleva escrito la manilla |
| `iat` | Cuándo te la pusieron |
| `exp` | Cuándo deja de valer |
| `JWT_SECRET` | El método secreto para hacer la marca auténtica |
| Signature | La marca que demuestra que es de verdad |

Lo importante es quién tiene el secreto: **solo el organizador**. Cualquiera
puede mirar una manilla y leer lo que pone, pero no puede fabricar una que pase
por auténtica.

[Captura: el diagrama de la manilla del PDF]

---

# Lo que instalamos

    npm install jsonwebtoken
    added 14 packages, and audited 137 packages

    npm list jsonwebtoken
    `-- jsonwebtoken@9.0.3

Es el **segundo paquete externo** del proyecto, después de bcrypt. Pasamos de
123 a 137 paquetes auditados y de 9 a 10 dependencias directas.

## Las variables nuevas

En `.env`:

    JWT_SECRET=<64 bytes aleatorios en hexadecimal>
    JWT_EXPIRES_IN=1h

El secreto se generó con `crypto.randomBytes(64)`, lo mismo que usamos para las
API Keys pero del doble de tamaño. Son 128 caracteres hexadecimales.

En `.env.example` van las dos variables pero **nunca el valor real**:

    JWT_SECRET=REEMPLAZAR_CON_SECRETO_JWT_SEGURO
    JWT_EXPIRES_IN=1h

`.gitignore` sigue cubriendo `.env`.

---

# Las capas nuevas

**`src/utils/jwt.util.js`**
Aísla todo lo de jsonwebtoken. Expone `obtenerSecreto`, `generarToken` y
`verificarToken`, más `obtenerExpiracion` por dentro.

**`src/middlewares/auth.middleware.js`**
`autenticarJWT`. Hace el camino inverso: lee la cabecera `Authorization`, saca
el token, lo verifica y deja `req.usuario` listo para quien venga detrás.

Y dos archivos modificados: `auth.controller.js` (el login ahora devuelve el
token) y `auth.routes.js` (la ruta `/perfil`).

## Qué metemos dentro del token, y qué no

El payload lleva solo esto:

    sub    -> id del usuario
    email  -> correo
    rol    -> rol actual

Más lo que añade jsonwebtoken solo: `iat` (cuándo nació) y `exp` (cuándo vence).

**No va la contraseña. Tampoco el passwordHash.** Esto no es una preferencia de
estilo, es obligatorio, y el motivo está en la siguiente sección.

Lo comprobamos a propósito: le pasamos a `generarToken` un objeto usuario que
**sí** incluía `passwordHash`, y no se coló. La función construye el payload
campo por campo, no hace spread del usuario.

## El algoritmo va fijo

Al firmar:

    algorithm: "HS256"

Y al verificar:

    algorithms: ["HS256"]

La segunda línea es la importante y merece explicación. Un JWT lleva en su
cabecera el algoritmo con el que dice estar firmado. Si al verificar no
restringimos nada, la librería **le hace caso al token**. Un atacante puede
mandar un token que declare `"alg": "none"`, sin firma ninguna, y colarse.

Con `algorithms: ["HS256"]` decimos: me da igual lo que declare el token, yo
solo acepto HS256. Lo probamos y funciona (prueba e más abajo).

---

# Firmar no es cifrar

Esta es la parte conceptual que más nos interesa del laboratorio.

Un JWT tiene tres partes separadas por puntos:

    HEADER . PAYLOAD . SIGNATURE

Las dos primeras son **base64**, no cifrado. Base64 no es un algoritmo de
seguridad: es una forma de escribir datos binarios con caracteres normales.
Cualquiera puede deshacerlo.

Lo demostramos con el token real que nos devolvió el login, sin usar el secreto
en ningún momento:

    node -e "console.log(require('jsonwebtoken').decode('<token>'))"

    {
      "email": "paciente@hospital.com",
      "rol": "paciente",
      "iat": 1790913138,
      "exp": 1790916738,
      "sub": "1"
    }

    lleva password?      false
    lleva passwordHash?  false

Ahí está todo el contenido del token, leído sin conocer `JWT_SECRET`.

Entonces, ¿para qué sirve la firma? Para dos cosas, y ninguna es ocultar:

- **Detectar alteraciones.** Si alguien cambia una letra del payload, la firma
  deja de corresponder.
- **Autenticar al emisor.** Solo quien tiene el secreto puede producir una firma
  válida.

La diferencia entre las dos operaciones:

    jwt.decode()  ->  lee el contenido
                      NO comprueba nada

    jwt.verify()  ->  lee el contenido
                      + comprueba la firma
                      + comprueba la expiración

**Decodificar un JWT no significa poder confiar en él.** Por eso en el
middleware usamos `verify`, nunca `decode`.

Y de ahí sale la regla práctica: nada secreto en el payload. Meter una
contraseña ahí pensando que el JWT la oculta sería regalarla.

[Captura: la salida de jwt.decode con el payload completo]

---

# El middleware y los dos objetos

El cliente manda:

    Authorization: Bearer eyJ...

Y `autenticarJWT` hace el recorrido:

    Authorization -> ¿viene? -> ¿formato "Bearer <token>"? -> jwt.verify()
                                                                  |
                                              ¿firma correcta? ¿no expiró?
                                                                  |
                                                            req.usuario

Después del middleware la petición lleva **dos objetos distintos**, y esto es lo
más vistoso del laboratorio:

    req.clienteApi  ->  información del consumidor   (viene de la API Key)
    req.usuario     ->  información de la persona    (viene del JWT)

## Un detalle del catch que añadimos

El `catch` del middleware no convierte cualquier error en un 401. Primero mira
de qué error se trata:

    const ERRORES_DE_TOKEN = [
      "JsonWebTokenError",
      "TokenExpiredError",
      "NotBeforeError"
    ];

Si el error **no** es uno de esos tres, hacemos `return next(error)` para que
suba al manejador global.

El caso real que esto cubre: si falta `JWT_SECRET`, `obtenerSecreto()` lanza un
`Error` normal. Sin esta comprobación, el servidor respondería **401 "Token
inválido"** a un fallo de configuración suyo. Le estaría echando la culpa al
cliente por algo que es nuestro, y además escondería la avería: el cliente
reintentaría con otro token para siempre, sin saber que el problema está en el
servidor. Con la comprobación sale un 500, que es lo honesto.

---

# Las pruebas

Doce pruebas contra el servidor corriendo. La API Key se leyó del `.env` dentro
de cada comando, sin escribirla.

## Flujo normal

| | Prueba | Código | Respuesta |
|---|---|---|---|
| ✅ | Registro de `paciente@hospital.com` | **201** | `rol: "paciente"`, `activo: true` |
| ✅ | Login | **200** | `usuario` + `token` de 207 caracteres, 3 partes |
| ✅ | a) `/perfil` con token válido | **200** | `usuario` del JWT + `clienteApi` de la API Key |

La respuesta de la prueba a) es la que resume el laboratorio:

    {
      "mensaje": "Usuario autenticado mediante JWT",
      "usuario":   { "id": 1, "email": "paciente@hospital.com", "rol": "paciente" },
      "clienteApi":{ "id": 1, "nombre": "Postman Laboratorio" }
    }

Una sola petición y el servidor sabe **qué aplicación** llama y **qué persona**
hay detrás.

## Ataques contra el token

| | Prueba | Código | Mensaje |
|---|---|---|---|
| ✅ | b) Sin cabecera `Authorization` | **401** | `Token de autenticación requerido` |
| ✅ | c) Token sin el esquema `Bearer` | **401** | `Formato de token inválido` |
| ✅ | d) Un carácter cambiado en la firma | **401** | `Token inválido` |
| ✅ | e) `alg: "none"` y sin firma | **401** | `Token inválido` |
| ✅ | f) Firmado con otro secreto | **401** | `Token inválido` |
| ✅ | g) Payload alterado a `rol: "administrador"` | **401** | `Token inválido` |

La g) es la más interesante. Cogimos el token legítimo, le cambiamos el payload
de `"rol": "paciente"` a `"rol": "administrador"` y **dejamos la firma original
intacta**. El servidor lo rechazó, porque la firma ya no corresponde a ese
contenido. Un atacante no puede ascenderse a sí mismo editando su propio token.

La f) demuestra lo mismo desde el otro lado: firmamos un token nuevo, bien
formado, con `rol: "administrador"`, pero con un secreto inventado. Rechazado
también. Sin `JWT_SECRET` no se fabrican tokens válidos.

## Las dos credenciales son independientes

| | Prueba | Código | Respuesta |
|---|---|---|---|
| ✅ | h) Token válido **sin** `X-API-Key` | **401** | `API Key requerida` |
| ⚠️ | i) Mismo token + API Key de App Móvil | **403** | `API Key deshabilitada` |
| ✅ | j) Mismo token + API Key de App Administrativa | **200** | `clienteApi: "Aplicación Administrativa"` |

La h) confirma que el JWT **no sustituye** a la API Key: con token válido pero
sin cabecera `X-API-Key`, la petición ni siquiera llega al middleware de JWT.

Sobre la i): esperábamos un 200 y salió un **403**. No es un fallo, es el estado
del proyecto. Desde el Lab 6, la "Aplicación Móvil" tiene `activa: false` a
propósito, justo para demostrar que se puede revocar un cliente sin tocar a los
demás. Así que ese 403 es el comportamiento correcto, solo que no era el que
teníamos en mente al escribir la prueba.

Para demostrar lo que queríamos ver repetimos con la App Administrativa, que sí
está activa, y salió la j): **mismo JWT, mismo usuario, distinto `clienteApi`**.
Eso prueba que las dos credenciales son ortogonales. El token dice quién eres;
la API Key, desde dónde llamas.

## Expiración

Cambiamos temporalmente `JWT_EXPIRES_IN=2s` y reiniciamos:

| | Prueba | Código | Mensaje |
|---|---|---|---|
| ✅ | k) `/perfil` inmediatamente | **200** | `Usuario autenticado mediante JWT` |
| ✅ | l) `/perfil` tras esperar 5 segundos | **401** | `Token expirado` |

El token decodificado confirmaba `exp - iat = 2 segundos`.

Nótese que el mensaje es distinto al de los ataques: **"Token expirado"**, no
"Token inválido". La firma del token seguía siendo perfectamente válida; lo que
falló fue el tiempo. Son dos cosas distintas y el middleware las distingue.

Después del experimento devolvimos `JWT_EXPIRES_IN=1h` y reiniciamos.

[Captura: las doce pruebas en Postman]

## Un error que cometimos por el camino

Lo anotamos porque casi nos cuela un resultado falso.

Al fabricar los tokens maliciosos guardamos los archivos en `/tmp`. En Git Bash
eso es una ruta, pero Node en Windows lo resuelve como `C:\tmp`, que no existía.
Los archivos salieron vacíos y las tres pruebas devolvieron **401 "Formato de
token inválido"**.

Visto por encima parecía que las pruebas habían pasado: eran 401, que es lo que
buscábamos. Pero el motivo era el equivocado. No se estaba rechazando un token
falsificado, se estaba rechazando una cabecera vacía, porque nunca llegó a
mandarse token alguno.

Lo repetimos con rutas correctas y entonces sí salieron los **401 "Token
inválido"** de verdad.

La lección: un código de estado correcto por el motivo equivocado no es una
prueba que valga. Hay que mirar también el mensaje.

---

# Swagger con dos esquemas

Añadimos `BearerAuth` junto al `ApiKeyAuth` que ya estaba:

    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT obtenido mediante el endpoint de login."
    }

## El detalle de OpenAPI que casi se nos escapa

En OpenAPI, esto:

    security:
      - ApiKeyAuth: []
      - BearerAuth: []

significa **API Key O Bearer**. Con una de las dos basta. Son dos objetos
distintos dentro del array.

Y esto otro:

    security:
      - ApiKeyAuth: []
        BearerAuth: []

significa **API Key Y Bearer**. Es un solo objeto con dos claves dentro.

La diferencia es la indentación. Lo verificamos en el JSON generado, no solo en
el comentario:

    "security": [{"ApiKeyAuth": [], "BearerAuth": []}]

Un solo objeto. Correcto.

Esto solo afecta a la documentación, no al comportamiento del servidor —
el middleware exige las dos pase lo que pase. Pero si el spec dijera "O", quien
lo leyera creería que puede entrar con una sola credencial, y el contrato
publicado estaría mintiendo.

## El login no pide JWT, y no puede pedirlo

    POST /api/auth/login    API Key ✅   JWT ❌   email/password ✅
    GET  /api/auth/perfil   API Key ✅   JWT ✅

Sería imposible exigir un JWT para obtener el JWT. El login **crea** el token;
`/perfil` lo **consume**.

## Los números del spec

    rutas (paths) : 17 -> 18
    endpoints     : 37 -> 38
    schemas       : 18 -> 19
    tags          :  7 ->  7

    referencias rotas: NINGUNA

Lo nuevo: la ruta `/api/auth/perfil` y el schema `RespuestaLogin`.

---

# Semgrep y npm audit

| | Lab 8 | Lab 9 |
|---|---|---|
| Reglas | 73 | 73 |
| Archivos | 40 | **42** |
| Hallazgos | 0 | **0** |

Los dos archivos nuevos son `jwt.util.js` y `auth.middleware.js`. Cuadra.

**npm audit**: `found 0 vulnerabilities`.

| | Lab 8 | Lab 9 |
|---|---|---|
| Dependencias directas | 9 | **10** |
| Añadidas | — | `jsonwebtoken@9.0.3` |
| Quitadas | — | ninguna |

Semgrep corrió sin problemas con el ejecutable normal; no hizo falta el fallback
de `pysemgrep` que teníamos preparado por si Windows lo bloqueaba.

Evidencias: `sast-semgrep-lab9.txt` y `sca-npm-audit-lab9.txt`.

---

# Lo que este laboratorio no resuelve

Sin adornarlo.

**El rol sigue sin dar ni quitar acceso.** El JWT lleva el rol dentro, el
middleware lo pone en `req.usuario`, y no sirve para nada todavía. Un `paciente`
autenticado llama exactamente a los mismos endpoints que un `administrador`.
Este laboratorio responde *quién eres*, no *qué puedes hacer*. Eso es la
autorización RBAC del bloque siguiente.

**Solo hay un endpoint protegido por JWT.** `/api/auth/perfil`, y existe
únicamente para probar que el mecanismo funciona. Pacientes, médicos,
consultorios y citas siguen abiertos con la sola API Key. Faltan 36 endpoints
por proteger.

**No se puede revocar un token.** Un JWT vale hasta que expira, y no hay forma de
anularlo antes. Si alguien roba un token con una hora de vida, tiene una hora de
acceso aunque nos demos cuenta en el primer minuto. No hay logout real, ni lista
de tokens revocados, ni refresh tokens. Esto es una característica incómoda de
JWT, no un olvido nuestro: los tokens son autocontenidos a propósito, y por eso
el servidor no lleva registro de cuáles ha emitido.

**No hay control de IDOR/BOLA.** Aunque supiéramos que quien llama es el paciente
1, nada le impide pedir los datos del paciente 2. El servidor comprueba que
estás autenticado, no que el recurso sea tuyo.

**Los usuarios siguen en memoria.** Se pierden en cada reinicio, igual que desde
el Lab 7.

**El token se guarda donde lo guarde el cliente.** Nosotros lo entregamos y ahí
acaba nuestra responsabilidad técnica, pero si el cliente lo mete en
`localStorage`, un XSS se lo lleva. Ese problema aparece en el bloque de XSS.

---

# Resumen

| Antes (Lab 8) | Ahora (Lab 9) |
|---|---|
| El login decía "correcto" y nada más | El login entrega un JWT |
| Cada petición volvía a empezar de cero | El token identifica al usuario |
| Solo `req.clienteApi` | `req.clienteApi` **y** `req.usuario` |
| Un esquema de seguridad en Swagger | Dos: ApiKeyAuth y BearerAuth |
| 37 endpoints | 38 endpoints |
| 40 archivos en Semgrep | 42 archivos, 0 hallazgos |
| 9 dependencias | 10 dependencias |

Y las tres preguntas quedan separadas:

    API KEY  ->  ¿quién consume?
    JWT      ->  ¿qué usuario?
    ROL      ->  ¿qué puede hacer?   (todavía sin implementar)

# Archivos de evidencia

| Archivo | Qué contiene |
|---|---|
| `sast-semgrep-lab9.txt` | Semgrep tras el Lab 9, 42 archivos, 0 hallazgos |
| `sca-npm-audit-lab9.txt` | npm audit, npm ls y npm list jsonwebtoken |
| `informe-lab8-hospital.md` | Informe del laboratorio anterior |

# Pendiente

Las capturas, y llevar el bloque al proyecto del equipo. Después: autorización
RBAC e IDOR/BOLA.
