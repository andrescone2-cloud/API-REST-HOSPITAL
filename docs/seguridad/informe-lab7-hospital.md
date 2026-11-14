# Laboratorio No. 7 — API_HOSPITAL

BLOQUE 4 — Usuarios + Hashing + Salting.
Fecha: 25 de septiembre de 2026.

Aquí contamos qué hicimos en el laboratorio, qué probamos y qué nos encontramos.

---

# El problema: sabíamos qué aplicación, no qué persona

Al terminar el Lab 6 teníamos esto:

    API KEY
       ↓
    "Aplicación Administrativa"

Y eso está bien, pero no es suficiente. Nos dice **qué programa** nos está
llamando. No nos dice nada de quién está detrás.

Si tres personas usan la Aplicación Administrativa, las tres llegan con la misma
API Key. Para nuestra API son exactamente la misma cosa. No podemos:

- saber quién hizo qué,
- darle permisos distintos a una que a otra,
- ni auditar nada por persona.

Lo que queremos añadir es el segundo nivel:

    email + password
        ↓
    identifica al USUARIO
        ↓
    Administrador / Médico / Paciente

En este laboratorio montamos el registro y el login. Todavía no hay token: el
login solo comprueba que las credenciales son correctas y responde. Guardar la
sesión es el bloque siguiente.

[Captura: el diagrama de la ruta OWASP, API Key → usuario → JWT → rol]

---

# Por qué bcrypt y no SHA-256

Esta parte nos interesa porque en el Lab 6 dijimos justo lo contrario, y las dos
cosas son ciertas.

**En el Lab 6** guardamos las API Keys con SHA-256 sin sal, y argumentamos que
servía. El motivo era la entropía: una API Key son 32 bytes que salieron de
`crypto.randomBytes`. Eso son 2^256 posibilidades. No hay diccionario, ni lista
de claves comunes, ni tabla precalculada que cubra ese espacio.

**Aquí no podemos hacer lo mismo**, porque una contraseña no la genera un
ordenador. La escribe una persona. Y las personas escriben:

    Juan123
    Hospital2026
    Password123

Ese espacio es pequeñísimo y está catalogado desde hace años. Contra eso,
SHA-256 falla por tres motivos distintos:

**Es determinista y sin sal.** Dos usuarios con la misma contraseña darían el
mismo hash, y se vería a simple vista.

**Hay rainbow tables.** Las contraseñas comunes ya están precalculadas. Buscar
el hash en una tabla es instantáneo.

**Es rápido a propósito.** SHA-256 está diseñado para ser veloz, que es
justamente lo que no queremos aquí. Una GPU calcula miles de millones por
segundo.

Por eso usamos bcrypt:

    PASSWORD + SALT aleatorio + COST
              ↓
            BCRYPT
              ↓
             HASH

El cost factor lo pusimos en 12:

    const SALT_ROUNDS = 12;

El cost es el trabajo computacional que bcrypt hace en cada operación. La idea
es **hacer cada intento deliberadamente caro**. Al usuario legítimo le cuesta
una fracción de segundo, una vez. Al atacante que prueba millones le cuesta
millones de veces esa fracción.

La conclusión que sacamos: un algoritmo de hash no es bueno ni malo en el vacío.
Depende de qué esté protegiendo.

| Qué protegemos | Cómo se genera | Algoritmo |
|---|---|---|
| API Key | `randomBytes(32)` | SHA-256 sirve |
| Contraseña | la escribe una persona | hace falta bcrypt |

---

# Qué es la sal, con nuestros hashes reales

Imaginemos dos usuarios con exactamente la misma contraseña.

Sin sal, una función determinista daría lo mismo las dos veces:

    Hospital2026 → HASH_X
    Hospital2026 → HASH_X

Con sal distinta, no:

    Hospital2026 + SAL_A → HASH_A
    Hospital2026 + SAL_B → HASH_B
    HASH_A ≠ HASH_B

## Lo comprobamos de verdad

Registramos dos usuarios con **la misma contraseña**, `ClaveSegura2026!`, y
sacamos los hashes por consola. Estos son los reales:

    <oculto>
    $2b$12$Hp2UP4uXDsmMENxo9CXnAO9Wpb47NrMzDs5zCw6AQdQczvHzLGpE2

    medico@hospital.com
    $2b$12$7hfjrGt.WDCZlmWEIDmuBeyQhdRy5OIzeArUQ5k9ahgqm2cVzyhHC

Los dos empiezan igual, `$2b$12$`, y a partir del carácter 8 no se parecen en
nada.

## Por qué no hay columna "salt"

Esto nos costó entenderlo al principio. No guardamos la sal por separado. Está
metida dentro del propio hash:

    $2b$12$Hp2UP4uXDsmMENxo9CXnAO9Wpb47NrMzDs5zCw6AQdQczvHzLGpE2
    │   │  └── sal + resultado derivado
    │   └───── cost factor (12)
    └───────── variante de bcrypt

Por eso `$2b$12$` es igual en los dos: son la variante y el cost, que los fijamos
nosotros. Lo que viene después es la sal, que bcrypt genera aleatoria cada vez.

Cuando hacemos `bcrypt.compare(password, hash)`, bcrypt lee la sal del propio
hash, la aplica a la contraseña que le damos y compara. No necesita nada más.

[Captura: la consola con los dos "Hash generado" seguidos]

## El console.log lo quitamos

Para ver los hashes pusimos temporalmente en `crearUsuario`:

    console.log("Hash generado:", nuevoUsuario.passwordHash);

Y lo borramos en cuanto terminamos la prueba. Un log normal no debe contener
hashes de credenciales: los logs se copian, se mandan por correo y acaban en
sitios donde no controlamos quién los lee.

Lo verificamos después: cero líneas de "Hash generado" tras un registro nuevo.

---

# Las seis capas nuevas

**`src/data/usuarios.js`**
Un array vacío. Ningún usuario de ejemplo con contraseña escrita en el código.
El primero se crea por el endpoint de registro.

**`src/utils/password.util.js`**
`generarPasswordHash` y `verificarPassword`. Aísla bcrypt, igual que
`crypto.util.js` aislaba SHA-256 en el Lab 6.

**`src/services/usuarios.service.js`**
Buscar por email y por id, crear usuario y verificar credenciales. También
exporta la constante `ROLES`.

**`src/middlewares/auth.validator.js`**
`validarRegistro` y `validarLogin`. Valida nombre, email, contraseña y rol.

**`src/controllers/auth.controller.js`**
`registrar` y `login`. Deciden los códigos HTTP y arman las respuestas.

**`src/routes/auth.routes.js`**
`POST /registro` y `POST /login`, con sus anotaciones OpenAPI.

## Las dos son async, y hay un motivo

`generarPasswordHash` y `verificarPassword` son `async` y usan `await`:

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

No es por gusto. bcrypt es **lento a propósito**, que es toda su gracia. Si lo
llamáramos de forma síncrona, ese trabajo bloquearía el hilo de Node entero.
Node tiene un solo hilo para JavaScript: mientras calcula un hash, no atiende a
nadie más.

O sea que un login cualquiera congelaría la API para todos los demás durante ese
rato. Con `async` el trabajo se va fuera y el servidor sigue respondiendo.

## Los tres roles en un solo sitio

El PDF escribe los roles directamente dentro del validador:

    .isIn(["administrador", "medico", "paciente"])

Nosotros los sacamos a una constante en el service y la exportamos:

    const ROLES = ["administrador", "medico", "paciente"];

El validador hace `.isIn(ROLES)`. Así hay una sola fuente de verdad. Si mañana
añadimos el rol `enfermero`, se toca un sitio y no dos.

## El orden de dependencias

    app.js
      ↓
    auth.routes.js
      ↓
    auth.controller.js  ←  auth.validator.js
      ↓                          ↓
    usuarios.service.js  ←───────┘ (ROLES)
      ↓
    usuarios.js (data)  +  password.util.js
                              ↓
                           bcrypt

Va en una dirección, sin ciclos.

[Captura: el árbol de src/ con los seis archivos nuevos]

---

# Por qué nunca sale el passwordHash

El objeto que guardamos en memoria es este:

    {
      id: 1,
      nombre: "Administrador Hospital",
      email: "<oculto>",
      passwordHash: "$2b$12$...",
      rol: "administrador",
      activo: true
    }

Si en el controlador hiciéramos `res.json({ usuario })`, mandaríamos el
`passwordHash` al cliente sin darnos cuenta. Por eso **armamos la respuesta
campo por campo**:

    registro → id, nombre, email, rol, activo
    login    → id, nombre, email, rol

Alguien podría decir: "pero un hash no es la contraseña, no pasa nada". Sí pasa.
Un hash filtrado se ataca **offline**, sin conexión y sin prisa. El atacante se
lo lleva a su máquina y prueba todas las contraseñas que quiera, sin rate limit
ni logs que le estorben. El cost 12 le hace el trabajo caro, pero no imposible
si la contraseña es mala.

Lo verificamos buscando `passwordHash`, `password` y `$2b$` en los cuerpos de
registro y login. No aparece ninguno.

[Captura: la respuesta 201 del registro, señalando lo que NO está]

---

# Por qué el 401 dice siempre lo mismo

Nuestro login responde exactamente igual en dos situaciones distintas:

    401
    { "mensaje": "Credenciales inválidas" }

Da igual si el correo no existe o si la contraseña está mal. Ni siquiera el
service lo distingue: `verificarCredenciales` devuelve `null` en los dos casos.

No decimos "el usuario no existe" ni "la contraseña es incorrecta".

## El motivo: enumeración de usuarios

Si las dos respuestas fueran distintas, cualquiera podría montar esto:

    login con juan@hospital.com + cualquiercosa  →  "el usuario no existe"
    login con ana@hospital.com  + cualquiercosa  →  "contraseña incorrecta"  ← ¡existe!

Probando correos uno por uno, sin acertar **ni una sola contraseña**, se saca la
lista de quién está registrado.

Y esa lista vale dinero. Sirve para phishing dirigido, para concentrar los
ataques de fuerza bruta solo en cuentas que sabes que existen, y para saber si
una persona concreta es paciente de este hospital, que en un contexto médico ya
es información sensible de por sí.

Comprobamos que los dos cuerpos son idénticos:

    password incorrecta  →  401  {"mensaje":"Credenciales inválidas"}
    usuario inexistente  →  401  {"mensaje":"Credenciales inválidas"}

[Captura: las dos respuestas 401 una al lado de la otra]

---

# Los dos niveles de control

Las rutas de auth cuelgan de `/api`, y `validarApiKey` ya estaba montado ahí
desde el Lab 5. Así que el registro y el login **también exigen API Key**.

Lo comprobamos:

    POST /api/auth/registro sin X-API-Key
    401 {"mensaje":"API Key requerida"}

El flujo completo queda así:

    Cliente autorizado
        │ X-API-Key          ← ¿QUÉ APLICACIÓN?
        ▼
    API Hospital
        │ email + password   ← ¿QUÉ PERSONA?
        ▼
    Usuario

Son dos preguntas distintas y las dos hacen falta. La API Key no sirve para
saber quién eres, y el email y la contraseña no sirven para saber desde qué
aplicación llamas.

Nos gustó que esto saliera **sin tocar nada**. No hubo que añadir ninguna
protección a las rutas nuevas: por colgar de `/api`, ya vienen protegidas.

---

# El detalle de normalizeEmail y los puntos de Gmail

Este no venía en el PDF. Lo encontramos al probar y nos pareció que había que
dejarlo escrito, porque cambia el comportamiento y no es obvio.

En el validador usamos:

    body("email").isEmail().normalizeEmail()

`normalizeEmail()` de express-validator no solo pasa a minúsculas. Para
direcciones de **Gmail** también quita los puntos y lo que va después de un `+`.

Lo probamos y esto es lo que hace:

| Entrada | Se guarda como |
|---|---|
| `Juan.Perez@gmail.com` | `juanperez@gmail.com` |
| `juanperez@gmail.com` | `juanperez@gmail.com` |
| `juan.perez+hospital@gmail.com` | `juanperez@gmail.com` |
| `Juan.Perez@hospital.com` | `juan.perez@hospital.com` |
| `Juan.Perez@outlook.com` | `juan.perez@outlook.com` |

Fijémonos: **solo a Gmail le quita los puntos**. A `hospital.com` y a
`outlook.com` se los deja, y solo los pasa a minúsculas.

## La consecuencia en nuestra API

Las tres primeras filas colapsan en la misma dirección. Eso significa que para
nuestra API **son el mismo usuario**. Lo comprobamos:

    POST /api/auth/registro  Juan.Perez@gmail.com   →  201, guardado como juanperez@gmail.com
    POST /api/auth/registro  juanperez@gmail.com    →  409, ya existe
    POST /api/auth/login     Juan.Perez@gmail.com   →  200, entra bien

    POST /api/auth/registro  Ana.Ruiz@hospital.com  →  201, guardado como ana.ruiz@hospital.com

## ¿Está bien o está mal?

Para Gmail está **bien**, porque Gmail de verdad ignora los puntos:
`juan.perez@gmail.com` y `juanperez@gmail.com` son literalmente el mismo buzón.
Si no normalizáramos, una misma persona podría crearse cuentas infinitas
cambiando dónde pone el punto.

Y no rompe el login, porque `validarLogin` normaliza igual que
`validarRegistro`. Lo que se guarda y lo que se busca pasan por la misma
función.

Lo que hay que tener en cuenta es que **el correo que guardamos no es
literalmente el que escribió el usuario**. Si algún día mandamos un correo de
verificación, sale a la dirección normalizada. Para Gmail llega igual. Para otro
proveedor que sí distinga puntos, no aplicaría, porque a esos no se los quita.

[Captura: la tabla de pruebas de normalizeEmail]

---

# bcrypt: el primer paquete externo del proyecto

Hasta ahora todo lo criptográfico lo hacíamos con `crypto`, que **viene con
Node**. En el Lab 6 lo dijimos: no se instala con npm, y si hiciéramos
`npm install crypto` nos bajaríamos un paquete abandonado del registro que no es
el módulo real.

bcrypt es distinto. No viene con Node, hay que traerlo:

    npm install bcrypt
    added 3 packages, and audited 123 packages in 3s
    found 0 vulnerabilities

    npm list bcrypt
    `-- bcrypt@6.0.0

Pasamos de 120 a **123 paquetes auditados**. De 8 dependencias directas a 9.

Es el primer paquete del proyecto cuyo mantenimiento no depende del equipo de
Node. Si mañana le sale una vulnerabilidad, nos toca a nosotros enterarnos y
actualizar. Por eso el `npm audit` de este laboratorio tiene más sentido que los
anteriores: es el primero que corre sobre una superficie que acabamos de
ampliar.

Además bcrypt es un **módulo nativo**: lleva código compilado, no solo
JavaScript. En Windows eso a veces falla si no están las herramientas de
compilación. A nosotros nos funcionó a la primera porque bajó un binario ya
compilado. Lo verificamos generando un hash de verdad, no solo comprobando que
el paquete estuviera en disco.

## Semgrep

    Ran 73 rules on 40 files: 0 findings.

Pasamos de 34 a 40 archivos, que son los seis nuevos. Sin hallazgos.

Evidencias: `sast-semgrep-lab7.txt` y `sca-npm-audit-lab7.txt`.

---

# Los usuarios viven en memoria

`src/data/usuarios.js` es esto:

    const usuarios = [];

Nada más. No hay base de datos.

Lo probamos: registramos tres usuarios, reiniciamos el servidor, e intentamos
entrar con los tres.

    login <oculto>   →  401
    login medico@hospital.com  →  401
    login ataque@hospital.com  →  401

Los tres desaparecieron. El array vuelve a estar vacío.

Un detalle práctico que nos pasó: para la prueba de los dos hashes tuvimos que
arrancar con `node src/app.js` en vez de `npm run dev`, porque `--watch` se
reinicia al detectar cambios en los archivos y nos vaciaba la memoria entre los
dos registros.

Esto cambia con Supabase/PostgreSQL más adelante.

[Captura: los tres 401 después del reinicio]

---

# Checkpoint Bloque 4A

| | Prueba | Esperado | Obtenido |
|---|---|---|---|
| ✅ | Registro válido | 201 | **201** |
| ✅ | Email duplicado | 409 | **409** "Ya existe un usuario con ese correo electrónico" |
| ✅ | Login correcto | 200 | **200** "Autenticación correcta" |
| ✅ | Password incorrecto | 401 | **401** "Credenciales inválidas" |
| ✅ | Usuario inexistente | 401 | **401** "Credenciales inválidas" |
| ✅ | Password < 10 caracteres | 400 | **400** "La contraseña debe tener entre 10 y 72 caracteres" |
| ✅ | Dos passwords iguales | hashes diferentes | `$2b$12$Hp2UP4...` ≠ `$2b$12$7hfjrG...` |
| ✅ | passwordHash en respuesta | nunca | ausente en registro y en login |
| ✅ | Mass assignment | bloqueado | ver abajo |
| ✅ | Reiniciar Node | usuarios desaparecen | los tres dan 401 |

**Los diez pasan.**

## La prueba de mass assignment

Mandamos un registro con campos que no deberían estar:

    {
      "nombre": "Usuario Ataque",
      "email": "ataque@hospital.com",
      "password": "ClaveSegura2026!",
      "rol": "paciente",
      "activo": false,
      "esSuperAdmin": true,
      "passwordHash": "HASH_FALSO",
      "id": 999
    }

Y esto es lo que pasó con cada uno:

| Campo inyectado | Resultado |
|---|---|
| `id: 999` | Ignorado. El servidor asignó **3** |
| `activo: false` | Ignorado. Quedó **true** |
| `esSuperAdmin: true` | No existe en el objeto |
| `passwordHash: "HASH_FALSO"` | Ignorado. Se generó un hash bcrypt real |

Lo del `passwordHash` lo comprobamos de la forma más directa: hicimos login de
ese usuario con la contraseña real y dio **200**. Si `HASH_FALSO` hubiera
entrado, ninguna contraseña habría validado nunca contra él.

Son dos defensas encadenadas, no una:

1. `matchedData(req, { locations: ["body"] })` descarta todo lo que el validador
   no declaró.
2. El service construye el objeto con un literal explícito, campo por campo, en
   vez de hacer spread del body. Y fuerza `activo: true`.

Con que fallara una, la otra seguiría aguantando. Eso es defensa en profundidad.

[Captura: el 201 del registro con los campos inyectados, y el usuario resultante]

---

# Limitaciones conocidas

Cuatro cosas que este laboratorio **no** resuelve. Las dejamos escritas para no
vendernos más de lo que tenemos.

**1. Los usuarios viven en memoria.** Se pierden en cada reinicio. No hay
persistencia.

**2. No hay token.** El login comprueba las credenciales y responde, pero no
devuelve nada que sirva para mantener la sesión. La siguiente petición no sabe
quién entró. Eso es JWT.

**3. No hay permisos por rol.** El usuario tiene un campo `rol`, pero ahora mismo
no cambia absolutamente nada. Un `paciente` autenticado puede llamar a los mismos
endpoints que un `administrador`. La autorización RBAC llega después del JWT.

**4. Cualquiera puede registrarse como administrador.** Esta es la más seria.

    POST /api/auth/registro
    { ..., "rol": "administrador" }
    → 201

El endpoint acepta `rol: "administrador"` sin preguntarle permiso a nadie. Con
tener una API Key válida, cualquiera se crea una cuenta de administrador.

Es una **escalada de privilegios** de manual. Ahora mismo no se nota porque el
rol no da acceso a nada, así que el daño es cero. Pero en cuanto el Bloque 5
haga que el rol importe, este agujero pasa a ser crítico: quien se registre como
administrador tendrá permisos de administrador de verdad.

El propio PDF lo anuncia como el Bloque 4B: cerrar la escalada de privilegios.
La idea es que crear usuarios privilegiados solo lo pueda hacer un administrador
ya autenticado.

---

# Resumen

| Antes (Lab 6) | Ahora (Lab 7) |
|---|---|
| Sabíamos qué aplicación llamaba | Sabemos también qué persona |
| API Keys con SHA-256 | Contraseñas con bcrypt cost 12 |
| Sin sal (y estaba bien) | Con sal, dentro del propio hash |
| Solo `crypto`, nativo de Node | Primer paquete externo: bcrypt |
| 35 endpoints | 37 endpoints |
| 34 archivos en Semgrep | 40 archivos, 0 hallazgos |

# Archivos de evidencia

| Archivo | Qué contiene |
|---|---|
| `sast-semgrep-lab7.txt` | Semgrep tras el Lab 7, 40 archivos, 0 hallazgos |
| `sca-npm-audit-lab7.txt` | npm audit, npm ls y npm list bcrypt |
| `informe-lab6-hospital.md` | Informe del laboratorio anterior |

# Pendiente

Llevar todo esto al proyecto del equipo, con documentación y capturas, como pide
el entregable. Y después el Bloque 4B, que cierra la escalada de privilegios.
