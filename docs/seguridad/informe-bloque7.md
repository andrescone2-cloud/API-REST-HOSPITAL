# BLOQUE 7 — API_HOSPITAL

Supabase + PostgreSQL: persistencia segura.
Fecha: 21 de octubre de 2026 (revisado el 23 de octubre).

Hasta el Bloque 6 todo vivía en arreglos de JavaScript y se perdía al reiniciar.
Este bloque cambia el origen de los datos sin tocar la seguridad que ya
construimos.

---

# Estado de la entrega

**Completado y verificado contra la base de datos real.** El proyecto Supabase
está creado, el esquema desplegado y la API funcionando con persistencia.

    Proyecto Supabase ....... creado
    Esquema ................. 7 tablas, 8 claves foráneas
    Roles de negocio ........ 3, activos
    RLS ..................... habilitado en las 7 tablas
    Conexión ................ TLS verificado, OK
    Pruebas del Bloque 6 .... 33 de 33 contra PostgreSQL
    Pruebas adicionales ..... 20 de 20
    Criterios de cierre ..... 22 de 22 (PUT, PATCH y 404)
    Conflictos de agenda .... 6 de 6
    Total ................... 81 de 81
    Bugs encontrados ........ 1, corregido
    Persistencia ............ confirmada tras reiniciar Node

---

# Lo que conserva el bloque

El PDF insiste en que la migración no puede costarnos lo ganado. Se comprobó uno
por uno:

| Componente | Estado |
|---|---|
| Rutas REST y Express | Intactas, mismos endpoints |
| `express-validator` y `matchedData()` | Intactos |
| bcrypt y JWT | Intactos |
| API Keys | Intactas, siguen viniendo de `.env` |
| RBAC (`roles.middleware.js`) | Intacto |
| BOLA/IDOR (`propiedad.middleware.js`) | Adaptado a async, misma lógica |
| JWT (`auth.middleware.js`) | Reforzado: ahora revalida contra la base |
| `/api/citas/mis-citas` | Intacto |
| Helmet, CORS, rate limit | Intactos |
| Swagger | Sin cambios semánticos |

---

# Cómo se trabajó

El profesor entregó `INSUMO_BLOQUE_7.zip`, que trae su `src/` con el bloque ya
aplicado, más los scripts SQL, el certificado y cuatro READMEs. Igual que en el
Lab 10, se comparó archivo por archivo en vez de copiar encima.

    insumo: 48 archivos .js   |   proyecto antes: 47

    archivo nuevo ................... 1  (src/config/database.js)
    diferencias reales de código ... 22
    archivos del proyecto ausentes ... 0

## Las cuatro divergencias, otra vez

El insumo del Bloque 7 vuelve a no tener las decisiones que se tomaron en
laboratorios anteriores. Se conservaron todas:

| # | Archivo | Qué se conservó |
|---|---|---|
| 1 | `auth.middleware.js` | La constante `ERRORES_DE_TOKEN`. El insumo adoptó el mismo principio escrito de otra forma, así que aquí se fusionó en vez de descartarlo |
| 2 | `jwt.util.js` | `obtenerSecreto()` y `obtenerExpiracion()` en vez de `obtenerConfiguracionJWT()` |
| 3 | `app.js` | `RATE_LIMIT_MAX` parametrizado |
| 4 | `usuarios.service.js` | `ROLES` y `ROL_POR_DEFECTO` como constantes del dominio |

La cuarta mereció trabajo extra. El insumo escribe `rol: "paciente"` a pelo en el
registro público y repite `["medico","administrador"]` dentro de la creación
administrativa. Se restauraron las constantes **sobre la lógica SQL nueva**, y se
añadió una tercera derivada de las otras dos:

    const ROLES = ["administrador", "medico", "paciente"];
    const ROL_POR_DEFECTO = "paciente";

    const ROLES_ADMINISTRABLES = ROLES.filter(
      (rol) => rol !== ROL_POR_DEFECTO
    );

`ROLES_ADMINISTRABLES` se calcula, no se escribe. Si mañana entra un rol nuevo
basta tocar `ROLES`, y la regla "los pacientes se crean por el registro público,
no por la operación administrativa" se mantiene sola.

También se descartaron tres archivos del insumo por ser solo formato:
`app.js`, `swagger.js` y `password.util.js` no cambian nada en el Bloque 7.

---

# Lo que se añadió

## Infraestructura

    database/01_esquema_hospital.sql     7 tablas, FK, restricciones, índices
    database/02_roles_seguridad.sql      3 roles de negocio, RLS, REVOKE
    database/03_verificacion.sql         comprobaciones
    database/README.md                   procedimiento completo
    certs/prod-ca-2021.crt               certificado TLS de Supabase
    scripts/probar-conexion.js           prueba de conectividad
    src/config/database.js               pool y función consultar()

Más los cuatro READMEs del profesor, en `docs/`.

## La dependencia

    npm install pg
    pg@8.23.1

De 10 a **11 dependencias directas**. `npm audit`: 0 vulnerabilidades.

## El módulo de conexión

`src/config/database.js` hace tres cosas antes de abrir el pool:

1. Falla si no existe `DATABASE_URL`.
2. Falla si no encuentra el certificado.
3. Exige TLS **con verificación**: `rejectUnauthorized: true`.

Esa tercera línea es la que importa. Sin ella, la conexión seguiría cifrada pero
aceptaría cualquier certificado, y un intermediario podría colocarse en medio.
Con el certificado de Supabase cargado explícitamente, el cliente comprueba que
está hablando con quien cree.

---

# Los seis services migrados

| Service | Origen de datos |
|---|---|
| `especialidades.service.js` | PostgreSQL |
| `medicos.service.js` | PostgreSQL |
| `pacientes.service.js` | PostgreSQL |
| `consultorios.service.js` | PostgreSQL |
| `citas.service.js` | PostgreSQL |
| `usuarios.service.js` | PostgreSQL |
| `apiKeys.service.js` | **memoria, a propósito** |

`apiKeys` se queda fuera y está bien: las API Keys salen de `.env` y se guardan
hasheadas en memoria. No son datos del hospital, son credenciales de los clientes
que consumen la API.

## El SQL va parametrizado

Se auditó expresamente, porque es el riesgo nuevo que introduce este bloque:

    datos de la petición que llegan a una plantilla SQL sin marcador: ninguno

Toda entrada de usuario viaja por marcadores `$1, $2, …`. Las únicas
interpolaciones con `${}` dentro de las consultas son constantes del módulo con
la lista de columnas:

    const columnas = `
      id, codigo, nombre, piso, ubicacion, activo
    `;

No dependen de ningún parámetro, así que no son una vía de inyección.

## Errores de PostgreSQL traducidos a HTTP

Los controllers de `auth` y `usuarios` aprendieron a leer los códigos de error de
PostgreSQL. El más importante:

    23505  unique_violation  ->  409 Conflict

Antes, el correo duplicado se detectaba con un `SELECT` previo. Ahora la
restricción `UNIQUE` de la base de datos lo garantiza aunque dos peticiones
lleguen a la vez. La comprobación en el controller sigue estando, pero ya no es
la única defensa: es la que da un mensaje bonito, y la base de datos es la que
de verdad lo impide.

Se añadió también `ROL_INVALIDO` como código de aplicación propio, para
distinguir "el rol que pides no existe en `public.roles`" de un fallo de SQL
cualquiera.

## El JWT ya no se cree a sí mismo

Este es el cambio de seguridad más importante del bloque, y casi se me pasa al
portar el código.

Hasta el Lab 10, `autenticarJWT` comprobaba la firma y la expiración, y con eso
daba por buenos el `id` y el `rol` que venían **dentro del token**. Tenía sentido
mientras los usuarios vivían en memoria: el token y los datos nacían y morían
juntos.

Con persistencia eso deja de valer. **Un token es una foto del pasado.** Entre
que se emite y se usa pueden pasar hasta `JWT_EXPIRES_IN` enteros, y en ese rato
la cuenta pudo borrarse, desactivarse o cambiar de rol.

Ahora el middleware, además de verificar la firma:

1. Exige que `sub` sea un entero positivo antes de meterlo en una consulta.
2. Busca el usuario en PostgreSQL. Si no existe → **401**,
   `"La cuenta asociada al token no existe"`.
3. Comprueba `activo`. Si está deshabilitado → **403**,
   `"Usuario deshabilitado"`.
4. Llena `req.usuario` con el **rol vigente en la base**, no con el del token.

El punto 4 es el que más cambia el modelo. Si un administrador degrada a alguien
de `administrador` a `paciente`, su token antiguo sigue teniendo firma válida y
`"rol": "administrador"` escrito dentro, pero deja de servirle: el servidor usa
lo que dice la base de datos.

Es también la respuesta parcial a una limitación que quedó anotada en el Lab 9:
*un JWT no se puede revocar*. Sigue sin poder revocarse el token en sí, pero
**desactivar la cuenta ahora surte efecto inmediato**, sin esperar a que expire.

El precio es una consulta más por petición autenticada.

Y el parseo de la cabecera se endureció: `authorization.trim().split(/\s+/)`
tolera espacios repetidos donde antes `split(" ")` habría fallado.

Nuestra constante `ERRORES_DE_TOKEN` se conservó. Vale la pena notar que el
insumo del profesor llega al mismo sitio por otro camino: comprueba los tres
nombres de error explícitamente y termina con `return next(error)`. O sea que el
criterio que adoptamos en el Lab 9 por nuestra cuenta acabó siendo el del
profesor.

## Validadores más estrictos

`citas.validator.js` y `medicos.validator.js` cambiaron de `isInt()` a una
comprobación propia, `esIdValido`, que rechaza enteros fuera del rango seguro de
JavaScript. Y la fecha dejó de validarse solo por formato: ahora comprueba que
exista en el calendario, así que un `2026-02-31` se rechaza.

Tiene sentido ahora y no antes: con arreglos en memoria un id disparatado
simplemente no encontraba nada. Contra PostgreSQL, un número fuera de rango es un
error de tipo que sube como 500 si nadie lo filtra antes.

## El middleware de propiedad, ahora asíncrono

`propiedad.middleware.js` pasó a `async/await` con `try/catch`, porque las
búsquedas de perfil ahora son consultas a la base de datos. La lógica de
autorización es la misma: administrador pasa, el resto compara su perfil con el
id de la URL.

---

# Puesta en marcha: lo que ocurrió de verdad

## El despliegue del esquema

Se automatizó con `scripts/preparar-base.js`, para no depender de copiar y pegar
en el SQL Editor. El script detecta si las tablas ya existen y, en ese caso, no
vuelve a ejecutar `01_esquema_hospital.sql`, que **no es idempotente**.

    EJECUTANDO SCRIPTS

      01_esquema_hospital.sql       OK
      02_roles_seguridad.sql        OK

    VERIFICACION

      Roles de negocio:
        1  administrador   true
        2  medico          true
        3  paciente        true

      Tablas (7 de 7): citas, consultorios, especialidades, medicos,
                       pacientes, roles, usuarios
      RLS habilitado en 7 de 7 tablas
      Claves foraneas: 8

    Base de datos lista.

Las ocho claves foráneas y las siete tablas coinciden con lo que documenta el
README del profesor.

## La conexión

    $ node scripts/probar-conexion.js

    base_datos: postgres   usuario: postgres

    Roles registrados:
      1  administrador  true
      2  medico         true
      3  paciente       true

    Conexión PostgreSQL exitosa

## El arranque

    Administrador inicial creado en PostgreSQL
    Servidor ejecutándose en http://localhost:3000

Y el administrador quedó en la tabla, no en memoria:

    id  nombre                  email               rol            activo
    1   Administrador Hospital  <oculto>  administrador  true

## Tres tropiezos por el camino

Vale la pena anotarlos porque son los que cualquiera se va a encontrar.

**La URI pegada sin la clave delante.** La cadena de conexión quedó en una línea
suelta del `.env`, sin `DATABASE_URL=`. dotenv ignora las líneas que no son
`CLAVE=valor`, así que seguía leyendo el marcador de ejemplo y el error era
`getaddrinfo ENOTFOUND HOST`.

**Contraseña equivocada.** El siguiente error fue
`password authentication failed for user "postgres"`. Ese mensaje es en realidad
una buena noticia: significa que el host resolvió, el TLS funcionó y Supabase
respondió. Solo fallaba la credencial. Se resolvió con **Reset database
password**, porque la original no se puede volver a consultar.

**El formato del código de consultorio.** `CONS-101` y no `C-101`: el validador
exige `/^CONS-[0-9]{3,4}$/`. Lo detectó el validador antes de llegar a la base,
que es exactamente donde debía detectarse.

---

# SAST y SCA

| | Lab 10 | Bloque 7 |
|---|---|---|
| Reglas Semgrep | 73 | **74** |
| Archivos escaneados | 47 | **48** |
| Hallazgos | 0 | **0** |
| Dependencias directas | 10 | **11** |
| `npm audit` | 0 vulnerabilidades | **0 vulnerabilidades** |

El archivo nuevo es `src/config/database.js`. La regla nueva es la que Semgrep
activa al detectar uso de `pg`: busca concatenación de SQL. **Cero hallazgos**
confirma por una vía independiente lo que se auditó a mano: las consultas están
parametrizadas.

Windows volvió a bloquear `semgrep.exe`, así que se usó otra vez el fallback por
módulo de Python. Queda anotado dentro del archivo de evidencia.

Evidencias: `sast-semgrep-bloque7.txt` y `sca-npm-audit-bloque7.txt`.

---

# Las pruebas contra PostgreSQL

Se repitieron las **30 pruebas obligatorias del Bloque 6** sobre datos
persistentes, con el escenario reconstruido en la base:

    usuario 1  administrador (bootstrap)
    usuario 2  medico        -> perfil medico   1
    usuario 3  Paciente A    -> perfil paciente 1  -> cita 1
    usuario 4  Paciente B    -> perfil paciente 2  -> cita 2
               medico ajeno  -> perfil medico   2  -> cita 3

**33 de 33 pasan** (las 30 de la guía más tres variantes). Mismos códigos y
mismos mensajes que con los arreglos en memoria: RBAC, BOLA, `/mis-citas`,
escritura restringida y la barrera de la API Key se comportan igual.

## Y 20 pruebas adicionales

| # | Prueba | Esperado | Obtenido |
|---|---|---|---|
| PG-1 | Correo duplicado (UNIQUE de PostgreSQL) | 409 | **409** |
| PG-2 | Registro médico duplicado (UNIQUE) | 409 | **409** `El registro médico pertenece a otro médico` |
| PG-3 | Especialidad inexistente (FK) | 400 | **400** `La especialidad indicada no existe` |
| 17 | Admin crea administrador | 201 | **201** |
| 20 | Admin intenta `rol:"superadmin"` | 400 | **400** |
| 21 | Paciente con `usuarioId` inexistente | 400 | **400** |
| 22 | Paciente con `usuarioId` de un admin | 409 | **409** |
| 23 | Mismo usuario a dos pacientes | 409 | **409** |
| 25 | Médico con `usuarioId` de un paciente | 409 | **409** |
| 26 | Mismo usuario a dos médicos | 409 | **409** |
| 10 | Admin borra paciente **con citas** | 409 | **409** |
| 10b | Admin borra médico **con citas** | 409 | **409** |
| 10c | Admin borra especialidad **con médicos** | 409 | **409** |
| 54 | Transición válida | 200 | **200** |
| 55 | Transición inválida | 409 | **409** |
| 39 | Admin consulta cita de cualquiera | 200 | **200** |
| — | Paciente GET/POST especialidades | 200 / 403 | **200 / 403** |
| — | Paciente GET médicos | 200 | **200** |
| — | Médico GET pacientes | 200 | **200** |

**20 de 20.** Con las 33 anteriores, 53 de 53 en este punto del bloque; las 22
de los criterios de cierre se añaden más abajo, hasta **81 de 81**.

Las tres primeras son nuevas de este bloque y son las que demuestran que las
restricciones ya no dependen solo del código: la unicidad del correo y del
registro médico la garantiza ahora `UNIQUE` en PostgreSQL, y la especialidad
inexistente la ataja la clave foránea.

La integridad referencial del Lab 5 sigue en pie (10, 10b, 10c) y la máquina de
estados del Lab 5 también (54, 55). **Ser administrador sigue sin permitir
saltarse las reglas de negocio.**

## La prueba que cierra el bloque

El objetivo declarado del laboratorio: *reiniciar Node.js no debe provocar la
pérdida de los datos*.

    ANTES del reinicio                 DESPUES del reinicio
      usuarios        10                 usuarios        10
      especialidades   3                 especialidades   3
      consultorios     2                 consultorios     2
      medicos          2                 medicos          2
      pacientes        2                 pacientes        2
      citas            3                 citas            3

    login paciente.a@hospital.com  ->  200
    login paciente.b@hospital.com  ->  200
    login medico@hospital.com      ->  200

    /mis-citas de Paciente A  ->  1 cita, pacienteId 1

Hasta el Lab 10, ese mismo reinicio dejaba la tabla de usuarios vacía y los tres
logins devolvían 401. **Ahora sobreviven.**

Un detalle que confirma que el bootstrap es idempotente: en el segundo arranque
el log **ya no dice** "Administrador inicial creado en PostgreSQL". Encontró la
cuenta existente, comprobó que sigue siendo administrador activo y la reutilizó
sin tocar nada.

# Un bug encontrado al verificar el cierre formal

Los READMEs 7.3 y 7.4 listan criterios de cierre que incluyen **PUT, PATCH y las
respuestas 404**. Al probarlos explícitamente apareció un fallo real.

## El síntoma

    PUT /api/especialidades/5
    { "nombre": "Dermatologia", ... }      <- su propio nombre, sin cambiarlo

    409  "Ya existe otra especialidad con ese nombre"

Actualizar una especialidad conservando su nombre era **imposible**.

## La causa

`especialidades.controller.js` comprobaba el duplicado así:

    if (existente && existente.id !== Number(id)) {

La intención es correcta: "hay otra con ese nombre y no soy yo". El problema es
el tipo. PostgreSQL devuelve los `id` de columnas `bigint` como **texto**, para
no perder precisión:

    id devuelto por pg : "1"   typeof: string
    id !== Number(id)  : true

Así que la comparación daba siempre "es otra" y el 409 saltaba contra el propio
registro. Con los arreglos en memoria el `id` era un número y funcionaba; la
migración lo rompió en silencio.

## Por qué solo ahí

El resto del proyecto ya usa un helper con coerción a texto:

    const mismoId = (a, b) =>
      a != null && b != null && String(a) === String(b);

Está en `consultorios.controller.js`, `medicos.controller.js`,
`pacientes.controller.js` y `propiedad.middleware.js`. **Solo
`especialidades.controller.js` se quedó con la comparación antigua**, en las dos
funciones de actualización. Es un descuido del insumo: el patrón se aplicó en
todos los recursos menos ese.

## El arreglo

Se añadió el mismo `mismoId` y se usó en los dos puntos, dejando el archivo
coherente con los demás. Se comprobaron las dos caras:

    PUT conservando su propio nombre   ->  200
    PUT con el nombre de OTRA          ->  409

La segunda importa tanto como la primera: el arreglo no podía consistir en
quitar la comprobación.

## Verificación del cierre formal

| Prueba | Resultado |
|---|---|
| PUT / PATCH especialidades, médicos, consultorios, citas | **200** |
| El cambio queda guardado en PostgreSQL (relectura) | confirmado |
| DELETE sin dependencias | **200** |
| 404 en especialidades, médicos, pacientes, consultorios, citas | **404** |
| PUT y DELETE sobre id inexistente | **404** |
| PUT con nombre de otra especialidad | **409** |

**22 de 22.** Y tras el arreglo se repitieron las suites anteriores sin
regresión: 33 de 33 y 20 de 20. Semgrep sigue en 0 hallazgos.

---

# Un segundo hueco: los conflictos de agenda

Al repasar los criterios de cierre del README 7.5 uno por uno apareció otro
descuido, esta vez **de las pruebas, no del código**. El README exige que "los
conflictos de agenda estén bloqueados". El código ya lo hacía:

```js
const conflictoMedico = await citasService.medicoTieneConflicto(...);
const conflictoConsultorio = await citasService.consultorioTieneConflicto(...);
```

Pero **ninguna de las 75 pruebas anteriores lo comprobaba**. Estaba implementado y
sin verificar, que para efectos de una entrega es casi lo mismo que no estarlo.
Se añadió una suite propia:

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| AG-1 | Mismo médico, misma fecha/hora, **otro** consultorio | 409 | **409** |
| AG-2 | Mismo consultorio, misma fecha/hora, **otro** médico | 409 | **409** |
| AG-3 | Mismo médico, misma fecha, **otra** hora | 201 | **201** |
| AG-4 | PUT que mueve una cita encima de otra | 409 | **409** |
| AG-5 | PUT que conserva su propia franja | 200 | **200** |

**6 de 6.** Total acumulado: **81 de 81**.

Dos decisiones sobre cómo se diseñó esta suite.

**AG-1 y AG-2 separan los dos conflictos.** Son reglas independientes: el médico
no puede estar en dos sitios a la misma hora aunque el consultorio sea otro, y el
consultorio no admite dos citas a la vez aunque el médico sea otro. Para aislarlas
hizo falta crear un segundo médico y un segundo consultorio; si no, una sola
prueba habría cubierto las dos cosas a la vez sin distinguir cuál falla.

**AG-3 es un control negativo, y es la prueba más importante de las cinco.** Sin
ella, una regla mal escrita que bloqueara *cualquier* cita del mismo médico
también habría devuelto 409 en AG-1 y AG-2, y las dos habrían "pasado" por el
motivo equivocado. AG-3 obliga a que la misma fecha con otra hora sí se permita,
así que el 409 de las anteriores solo puede venir del solapamiento real.

AG-5 es la hermana del bug de la sección anterior: una cita que conserva su propia
franja no debe chocar consigo misma. Aquí sí estaba bien resuelto, porque la
consulta de conflicto excluye la propia cita. En especialidades no lo estaba.

---

# Lo que este bloque no resuelve

**Las políticas RLS no están escritas.** `02_roles_seguridad.sql` **habilita**
Row Level Security en las siete tablas y hace `REVOKE` sobre `anon` y
`authenticated`, pero no crea políticas por paciente o por médico. Hoy el control
de propiedad lo sigue haciendo Express, no la base de datos. El propio README del
profesor lo dice: las políticas se diseñarán al integrar Supabase Auth.

Importante entenderlo bien: RLS habilitado **sin políticas** significa que nadie
pasa por esa vía, no que todos pasen. La API funciona porque se conecta con un
usuario de PostgreSQL que no está sujeto a RLS. La defensa real sigue siendo el
middleware.

**Los archivos `src/data/*.js` quedaron huérfanos.** Los seis arreglos en memoria
ya no los requiere nadie. Se conservan porque el insumo del profesor también los
conserva y sirven de referencia del seed, pero son código muerto.

**`usuarios.auth_user_id` existe y no se usa.** La columna está en el esquema
esperando a Supabase Auth. Mientras tanto la autenticación la sigue haciendo
bcrypt + JWT desde Express.

**La revalidación cuesta una consulta por petición.** Cada llamada autenticada
hace ahora un `SELECT` sobre `usuarios`. Es el precio de que desactivar una
cuenta surta efecto inmediato. Con volumen habría que mirar caché con TTL corto,
pero eso reintroduce la ventana que acabamos de cerrar.

**Queda un paso manual en el panel de Supabase.** En
**Database → Settings → SSL configuration** hay que activar **Enforce SSL on
incoming connections**. Node ya usa TLS verificado, así que no cambia el
comportamiento, pero cierra la puerta a cualquier cliente que intente conectarse
sin cifrar. Eso solo se puede tocar desde el panel.

---

# Resumen

| Antes (Bloque 6) | Ahora (Bloque 7) |
|---|---|
| Arreglos en memoria | PostgreSQL en Supabase |
| Los datos se perdían al reiniciar | Persistencia real (cuando haya conexión) |
| Unicidad garantizada en el controller | Garantizada por `UNIQUE` en la base |
| `isInt()` | `esIdValido` + fecha de calendario real |
| Propiedad comprobada en memoria | Comprobada con consultas, en async |
| 10 dependencias | 11 dependencias |
| 47 archivos en Semgrep | 48 archivos, 0 hallazgos |
| 33 pruebas verificadas | 81 pruebas verificadas |
| Conflictos de agenda sin probar | 6 pruebas, 6 pasan |

# Archivos de evidencia

| Archivo | Qué contiene |
|---|---|
| `sast-semgrep-bloque7.txt` | Semgrep, 48 archivos, 74 reglas, 0 hallazgos |
| `sca-npm-audit-bloque7.txt` | npm audit y npm ls, 11 dependencias |
| `informe-lab10.md` | Informe del laboratorio anterior |
