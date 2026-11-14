# BLOQUE 7 — Resumen de lo implementado

API_HOSPITAL · Migración a Supabase / PostgreSQL
Cerrado el 24 de octubre de 2026.

> Este archivo es el **resumen propio** del bloque, pensado como base para la
> documentación. Los archivos `README_BLOQUE_7_2.md` … `README_BLOQUE_7_5.md`
> son la guía original del profesor y no se modificaron.

---

## 1. Qué cambió, en una frase

Hasta el Bloque 6 los datos vivían en arreglos de JavaScript y se perdían al
reiniciar Node. Ahora viven en PostgreSQL alojado en Supabase, con TLS
verificado, **sin perder ninguna de las defensas de los bloques anteriores**.

| Antes (Bloque 6) | Ahora (Bloque 7) |
|---|---|
| Arreglos en memoria (`src/data/*.js`) | PostgreSQL en Supabase |
| Los datos se perdían al reiniciar | Persistencia real, comprobada |
| Unicidad garantizada por el controller | Garantizada por `UNIQUE` en la base |
| Integridad por comprobación manual | Reforzada por claves foráneas |
| Servicios síncronos | Servicios `async`, 51 consultas parametrizadas |
| 10 dependencias | 11 dependencias (`pg`) |
| 47 archivos en Semgrep | 48 archivos, 0 hallazgos |
| 33 pruebas verificadas | **81 pruebas verificadas** |

---

## 2. Archivos nuevos

| Archivo | Para qué |
|---|---|
| `src/config/database.js` | Pool de conexiones y helper `consultar()` |
| `certs/prod-ca-2021.crt` | Certificado raíz de Supabase, para validar el servidor |
| `database/01_esquema_hospital.sql` | 7 tablas, claves foráneas, índices |
| `database/02_roles_seguridad.sql` | Roles de negocio, habilita RLS, revoca permisos |
| `database/03_verificacion.sql` | Consultas de comprobación |
| `database/README.md` | Procedimiento de despliegue de la base |
| `scripts/preparar-base.js` | Ejecuta el SQL de forma segura y verifica el resultado |
| `scripts/probar-conexion.js` | Prueba de conexión y lectura de `public.roles` |

### Archivos reescritos

Los **seis services** pasaron de manipular arreglos a ejecutar SQL:

| Service | Consultas |
|---|---|
| `citas.service.js` | 14 |
| `medicos.service.js` | 11 |
| `pacientes.service.js` | 8 |
| `consultorios.service.js` | 7 |
| `especialidades.service.js` | 7 |
| `usuarios.service.js` | 3 (las demás funciones reutilizan estas) |

También se adaptaron los controllers a `async/await`, el middleware de propiedad
(`propiedad.middleware.js`) y el de autenticación (`auth.middleware.js`).

`apiKeys.service.js` **no** se migró: las API Keys siguen en `.env`, hasheadas con
SHA-256. Es una decisión consciente, no un olvido — se documenta en el punto 9.

---

## 3. La conexión: TLS verificado, no solo cifrado

`src/config/database.js` hace tres cosas que conviene destacar en la
documentación:

```js
const certificado = fs.readFileSync(rutaCertificado).toString();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: certificado,
    rejectUnauthorized: true,
  },
});
```

1. **Falla al arrancar** si falta `DATABASE_URL` o el certificado, en vez de
   fallar más tarde con un error confuso.
2. **`rejectUnauthorized: true`** con el certificado raíz cargado. Cifrar sin
   validar la identidad del servidor no protege igual: cualquiera que se
   interponga podría presentar su propio certificado.
3. **Nunca imprime la cadena de conexión**, ni en logs ni en errores.

Se usa el **Session pooler (puerto 5432)**, no el Transaction pooler (6543),
porque el proyecto mantiene un pool propio.

> **Nota, y es importante para la documentación.** Durante buena parte del bloque
> el `.env` apuntaba en realidad a la **conexión directa**
> (`db.<REF>.supabase.co:5432`). Funcionó hasta que la red local perdió la ruta
> **IPv6**: esa conexión publica solo registro AAAA, así que dejó de ser
> alcanzable con `Connection terminated due to connection timeout`, sin que nada
> del proyecto hubiera cambiado.
>
> | | Conexión directa | Session pooler |
> |---|---|---|
> | usuario | `postgres` | `postgres.<REF>` |
> | host | `db.<REF>.supabase.co` | `aws-0-<REGIÓN>.pooler.supabase.com` |
> | DNS | 1 dirección, **solo IPv6** | 3 direcciones, **IPv4** |
> | Si la red no tiene IPv6 | inalcanzable | funciona |
>
> El cambio es **una línea del `.env`**; `database.js` no distingue entre ambas y
> el mismo certificado sirve para las dos. El `database/README.md` del profesor ya
> lo adelanta: *"Session pooler: alternativa cuando se necesita compatibilidad
> IPv4"*.

En Supabase está activado **Enforce SSL**. Se comprobó intentando conectar a
propósito con `ssl: false`: PostgreSQL responde `no encryption`.

---

## 4. Seguridad de las consultas

**Todas** las consultas usan marcadores `$1, $2, …`. Ninguna concatena entrada
del usuario:

```js
const resultado = await consultar(
  `SELECT ${columnasUsuario} FROM public.usuarios WHERE email = $1`,
  [email],
);
```

Lo único interpolado con `${}` es `columnasUsuario`, que es una **constante del
módulo** — no depende de la petición. Semgrep lo confirma por una vía
independiente: 0 hallazgos con la regla de concatenación SQL activa.

Los errores de PostgreSQL se traducen a códigos HTTP en vez de propagarse:

| Código PG | Significado | HTTP |
|---|---|---|
| `23505` | Violación de `UNIQUE` | 409 |
| `23503` | Violación de clave foránea | 400 |

---

## 5. El JWT ya no se cree a sí mismo

Cambio de seguridad importante del bloque. Antes el middleware confiaba en el
`rol` que venía dentro del token. Ahora, en cada petición autenticada:

1. Verifica la firma con `algorithms: ["HS256"]` (bloquea `alg: none`).
2. Comprueba que `sub` sea un id válido.
3. **Consulta la identidad real en PostgreSQL.**
4. Si la cuenta no existe → **401**. Si está desactivada → **403**.
5. Usa el **rol vigente en la base**, no el del token.

```js
req.usuario = { id: String(usuario.id), email: usuario.email, rol: usuario.rol };
```

**Consecuencia práctica:** desactivar una cuenta surte efecto inmediato, sin
esperar a que caduque el token. **Coste:** una consulta por petición autenticada.

---

## 6. Resultados de las pruebas: 81 de 81

| Suite | Qué cubre | Resultado |
|---|---|---|
| Bloque 6 | JWT, RBAC, BOLA/IDOR, `/mis-citas`, API Key | **33 de 33** |
| Adicionales | `UNIQUE`, claves foráneas, integridad, estados | **20 de 20** |
| Criterios de cierre | PUT, PATCH, DELETE y 404 en los 5 recursos | **22 de 22** |
| Conflictos de agenda | Doble agenda de médico y de consultorio | **6 de 6** |
| **Total** | | **81 de 81** |

### Las tres pruebas nuevas que cambian el modelo de garantías

| # | Prueba | Resultado | Quién lo impide **ahora** |
|---|---|---|---|
| PG-1 | Correo duplicado | 409 | `UNIQUE` en PostgreSQL |
| PG-2 | Registro médico duplicado | 409 | `UNIQUE` en PostgreSQL |
| PG-3 | Especialidad inexistente | 400 | Clave foránea |

Antes la unicidad dependía de que el controller hiciera un `SELECT` previo. Esa
comprobación sigue ahí y es la que da el mensaje legible, pero **ya no es la única
defensa**: si dos peticiones llegan a la vez, la restricción de la base lo impide
igual.

### Conflictos de agenda

| # | Caso | Esperado | Obtenido |
|---|---|---|---|
| AG-1 | Mismo médico, misma hora, **otro** consultorio | 409 | 409 |
| AG-2 | Mismo consultorio, misma hora, **otro** médico | 409 | 409 |
| AG-3 | Mismo médico, misma fecha, **otra** hora | 201 | 201 |
| AG-4 | PUT que mueve una cita encima de otra | 409 | 409 |
| AG-5 | PUT que conserva su propia franja | 200 | 200 |

**AG-3 es un control negativo y es la prueba más importante de las cinco.** Sin
ella, una regla mal escrita que bloqueara *cualquier* cita del mismo médico
también habría devuelto 409 en AG-1 y AG-2, y las dos habrían "pasado" por el
motivo equivocado.

### Persistencia

Antes y después de reiniciar Node, con la base ya poblada:

    usuarios 45, especialidades 3, consultorios 2,
    medicos 2, pacientes 2, citas 7

Idénticos, y los tres logins siguen devolviendo 200. Con un token nuevo,
`/mis-citas` de Paciente A devuelve sus 5 citas, todas con `pacienteId` 1.

Hasta el Lab 10 ese mismo reinicio vaciaba la tabla y los tres logins daban 401.

El bootstrap del administrador quedó **idempotente**: en el segundo arranque el
log ya no dice "Administrador inicial creado". Encuentra la cuenta, comprueba que
sigue siendo administrador activo y la reutiliza.

---

## 7. El bug encontrado al verificar el cierre

Vale la pena documentarlo porque es el hallazgo más instructivo del bloque.

**Síntoma:** un `PUT` que conservaba su propio nombre respondía 409.

    PUT /api/especialidades/12
    { "nombre": "Dermatologia", ... }      <- su propio nombre, sin cambiarlo

    409  "Ya existe otra especialidad con ese nombre"

**Causa:** una línea de `especialidades.controller.js`.

```js
if (existente && existente.id !== Number(id)) {
```

PostgreSQL devuelve las columnas `bigint` **como texto**, y `req.params.id`
también llega como texto:

| expresión | valor | tipo |
|---|---|---|
| `existente.id` | `"12"` | string |
| `Number(id)` | `12` | number |
| `"12" !== 12` | `true` | el 409 saltaba contra el propio registro |

**Arreglo:** el mismo helper que ya usaban los demás controllers.

```js
const mismoId = (a, b) =>
  a != null && b != null && String(a) === String(b);
```

**Por qué importa:** con arreglos en memoria el `id` era un número de JavaScript
y la comparación funcionaba. La migración lo rompió **en silencio** — sin
excepción, sin log, y sin que ninguna de las 53 pruebas de entonces lo detectara,
porque ninguna hacía un PUT conservando su propio nombre.

El arreglo **no fue quitar la comprobación**: la prueba `E-409` verifica la otra
cara, que usar el nombre de *otra* especialidad sigue devolviendo 409.

---

## 8. SAST y SCA

| Herramienta | Resultado |
|---|---|
| Semgrep | 48 archivos, 74 reglas, **0 hallazgos** |
| npm audit | **0 vulnerabilidades**, 11 dependencias directas |

Son un archivo más y una regla más que en el Lab 10: el archivo es
`src/config/database.js`, y la regla es la que Semgrep activa al detectar que el
proyecto usa `pg` — busca exactamente concatenación de SQL.

---

## 9. Lo que este bloque **no** resuelve

Conviene decirlo explícitamente en la documentación, porque son decisiones, no
descuidos.

**Las políticas RLS no están escritas.** `02_roles_seguridad.sql` **habilita** Row
Level Security en las siete tablas y revoca permisos a `anon` y `authenticated`,
pero no crea políticas por paciente o por médico. Se verificó contra la base:

    pg_policies (schema public) .............. 0 filas
    anon / authenticated en las 7 tablas ..... 0 permisos
    RLS ON ................................... 7 de 7
    rol con el que conecta la API ............ rolbypassrls: true

> No hay que malinterpretarlo: RLS habilitado **sin políticas** significa que
> **nadie** pasa por esa vía, no que todos pasen. La API funciona porque se
> conecta con un usuario de PostgreSQL que no está sujeto a RLS. Hoy el control
> de propiedad lo sigue haciendo Express. Las políticas se diseñarán al integrar
> Supabase Auth, tal como indica la guía del profesor.

**`usuarios.auth_user_id` existe y no se usa.** La columna está en el esquema
esperando a Supabase Auth. Mientras tanto autentica bcrypt + JWT desde Express.

**Los archivos `src/data/*.js` quedaron huérfanos.** Los seis arreglos en memoria
ya no los requiere nadie. Se conservan como referencia del seed, pero son código
muerto.

**Las API Keys siguen en `.env`.** Hasheadas con SHA-256 y comparadas con
`crypto.timingSafeEqual`. No se migraron a la base en este bloque.

**La revalidación cuesta una consulta por petición** (punto 5).

---

## 10. Cómo reproducirlo

```bash
npm install

# 1. Desplegar el esquema (idempotente: detecta si las tablas ya existen)
node scripts/preparar-base.js

# 2. Comprobar la conexión y el TLS
node scripts/probar-conexion.js

# 3. Levantar la API
npm run dev
```

`.env` necesita, además de lo de bloques anteriores:

    DATABASE_URL=postgresql://...     # Session pooler, puerto 5432

El certificado `certs/prod-ca-2021.crt` se descarga desde
**Supabase → Database → Settings → SSL configuration → Download certificate**.

### Un detalle sobre el rate limit

Al repetir las pruebas aparecen respuestas **429**. No es un fallo: es el
`RATE_LIMIT_MAX=100` del Lab 5 funcionando (100 peticiones por ventana de 15
minutos sobre `/api`). Para una corrida completa de pruebas:

    RATE_LIMIT_MAX=100000 npm run dev

El valor de servicio en `.env` sigue siendo 100.

---

## 11. Tropiezos durante la puesta en marcha

Se anotan porque son los que cualquiera se va a encontrar al repetirlo.

| Error | Causa real | Solución |
|---|---|---|
| `getaddrinfo ENOTFOUND HOST` | La URI quedó en una línea suelta del `.env`, sin `DATABASE_URL=`. dotenv ignora lo que no sea `CLAVE=valor` | Ponerla dentro de la clave |
| `password authentication failed` | Credencial incorrecta. **Es buena señal**: el host resolvió y el TLS funcionó | Reset database password en Supabase |
| `relation "public.roles" does not exist` | La conexión era buena, pero el esquema no estaba desplegado | `node scripts/preparar-base.js` |
| 400 al crear consultorio | El validador exige `/^CONS-[0-9]{3,4}$/`, no `C-101` | Usar `CONS-101` |

---

## 12. Dónde está el resto

    docs/seguridad/informe-bloque7.md        informe largo, con el detalle técnico
    docs/seguridad/sast-semgrep-bloque7.txt  Semgrep, 48 archivos, 0 hallazgos
    docs/seguridad/sca-npm-audit-bloque7.txt npm audit, 11 dependencias
    database/README.md                       procedimiento de la base de datos
    docs/README_BLOQUE_7_2..5.md             la guía original del profesor

Las **13 capturas de evidencia** están fuera del proyecto, en
`Escritorio/Evidencias_Bloque7_Hospital`, junto con `RESUMEN_BLOQUE7_HOSPITAL.md`.

---

## 13. Nota sobre secretos

Ni este archivo ni los informes ni las capturas contienen la `DATABASE_URL`, la
contraseña de PostgreSQL, las API Keys, el `JWT_SECRET` ni el correo del
administrador. Los scripts de evidencia se escribieron para no imprimirlos, y se
verificó con un barrido sobre los 116 archivos del proyecto y de la carpeta de
evidencias.
