# Laboratorio No. 8 — API_HOSPITAL

BLOQUE 4B — Control del rol y prevención de escalada de privilegios.
Fecha: 28 de septiembre de 2026.

Este laboratorio cierra el agujero que quedó abierto y documentado al final del
Lab 7.

---

# El problema que veníamos arrastrando

En el informe del Lab 7 lo dejamos escrito como la cuarta limitación conocida:
cualquiera con una API Key válida podía registrarse como administrador.

    POST /api/auth/registro
    { "nombre": "...", "email": "...", "password": "...", "rol": "administrador" }
    → 201, usuario creado con rol administrador

Y lo dijimos entonces: el daño era **cero**, porque el rol no daba acceso a
nada. Un `administrador` podía llamar exactamente a los mismos endpoints que un
`paciente`.

Pero el bloque siguiente va a hacer que el rol importe. El día que la
autorización por rol entre en funcionamiento, esta puerta pasa de irrelevante a
crítica sin que nadie toque una sola línea de ese endpoint. Por eso se cierra
ahora, antes.

## Fallaban dos piezas a la vez

**Primera, el validador.** `auth.validator.js` declaraba:

    body("rol")
      .isIn(ROLES)

Al declararlo, `rol` pasaba a ser un campo válido del contrato de entrada. Y
como era válido, `matchedData` lo dejaba pasar tal cual.

**Segunda, el service.** `usuarios.service.js` hacía:

    rol: datos.rol

Es decir, confiaba en lo que le llegaba.

El resultado es la suma de las dos:

    Cliente controla "rol"
            +
    Service confía en "rol"
            ↓
    ESCALADA DE PRIVILEGIOS

[Captura: el registro del Lab 7 devolviendo rol administrador]

---

# Las dos defensas, y por qué hacen falta las dos

La solución rompe las dos piezas, no una. Conviene entender por qué no basta con
arreglar solo una.

**Si solo quitáramos la validación**, el service seguiría ejecutando
`rol: datos.rol`. Como `datos` ya no traería `rol`, guardaría `undefined`. El
ataque quedaría frenado, sí, pero por accidente: el usuario nacería con un rol
inválido y el sistema quedaría en un estado que nadie diseñó.

**Si solo arregláramos el service**, el rol seguiría siendo un campo aceptado del
contrato. El schema de Swagger seguiría anunciándolo, el validador seguiría
comprobándolo, y cualquiera que leyera la documentación creería que puede
elegirlo. La defensa estaría, pero el contrato estaría mintiendo.

La idea es que **cada capa tiene que ser correcta por su cuenta**, no apoyada en
que la de al lado haga su trabajo. Eso es defensa en profundidad.

## Primera defensa — auth.validator.js

Se eliminó por completo el bloque `body("rol")`. `validarRegistro` declara ahora
tres campos:

    nombre
    email
    password

`validarLogin` no se tocó.

Al quitar la validación, la importación de `ROLES` quedaba sin uso en ese
archivo, así que también se retiró. No tiene sentido dejar un `require` muerto
apuntando a algo que ya no se usa.

## ROLES sigue existiendo, y es a propósito

`ROLES` **no se borró** de `usuarios.service.js`, y se sigue exportando.

Dejó de usarse para validar la entrada, pero sigue siendo la lista de roles que
existen en el sistema. Es una constante del dominio, no un artefacto del
validador. El bloque siguiente la va a necesitar para decidir permisos.

Se le actualizó el comentario para que quien la lea entienda por qué está ahí
aunque nadie la llame todavía.

## Segunda defensa — usuarios.service.js

La línea crítica cambió de:

    rol: datos.rol

a:

    rol: ROL_POR_DEFECTO

El valor no se escribió como cadena suelta dentro del objeto. Se definió como
constante con nombre, junto a `ROLES`:

    // ========================================
    // Rol por defecto al registrarse
    //
    // El menos privilegiado de los tres. Todo
    // usuario creado por el registro público
    // nace con este rol.
    // ========================================

    const ROL_POR_DEFECTO = "paciente";

Se eligió `paciente` porque es **el menos privilegiado de los tres**. Si algún
día hay una duda sobre qué rol debe recibir alguien, la respuesta correcta es
siempre el que menos puede hacer.

Y dentro de `crearUsuario`, los dos valores que decide el servidor quedaron
marcados con el comentario de bloque del proyecto:

    // ====================================
    // Valores controlados por el servidor
    //
    // No salen de datos. El cliente no los
    // decide aunque los mande en el body.
    // ====================================

    rol: ROL_POR_DEFECTO,

    activo: true

`activo: true` ya venía forzado desde el Lab 7. Ahora `rol` lo acompaña.

## El controller no se tocó

`auth.controller.js` no necesitó ni un cambio. Se verificó en lugar de darlo por
supuesto: sus únicas menciones a `rol` están al **construir la respuesta**,
leyendo `usuario.rol`, o sea el valor que el servidor ya asignó. No lee `rol` de
la entrada en ningún punto, y no hay un solo `req.body` en el archivo.

Eso es la mejor señal de que las capas están bien separadas:

    Validator  →  ¿qué datos acepto?
    Controller →  ¿qué operación realizo?
    Service    →  ¿cómo construyo y persisto el usuario?

Cambiaron las dos puntas y el intermediario ni se enteró.

[Captura: el diff del validator y del service, lado a lado]

---

# Qué consigue matchedData

El controlador ya leía así desde el Lab 7:

    const datos = matchedData(req, { locations: ["body"] });

Supongamos que un atacante manda:

    {
      "nombre": "Usuario Ataque",
      "email": "ataque@hospital.com",
      "password": "ClaveSegura2026!",
      "rol": "administrador",
      "activo": false,
      "esSuperAdmin": true
    }

`req.body` contiene los seis campos. Todos. Express no filtra nada.

Pero después de `matchedData()`, `datos` queda:

    {
      nombre: "Usuario Ataque",
      email: "ataque@hospital.com",
      password: "ClaveSegura2026!"
    }

Desaparecen `rol`, `activo` y `esSuperAdmin`, porque ninguno de los tres está
declarado en `validarRegistro`.

`matchedData` no devuelve lo que llegó: devuelve **lo que el validador declaró**.
Esa es la primera barrera.

---

# El ataque

## Prueba normal, sin rol (parte 9)

    POST /api/auth/registro
    {
      "nombre": "Paciente Hospital",
      "email": "paciente@hospital.com",
      "password": "ClaveSegura2026!"
    }

    201 Created
    {
      "mensaje": "Usuario registrado correctamente",
      "usuario": {
        "id": 1,
        "nombre": "Paciente Hospital",
        "email": "paciente@hospital.com",
        "rol": "paciente",
        "activo": true
      }
    }

El cliente nunca dijo `rol = paciente`. Lo decidió el servidor.

## Intento de escalada (parte 10)

    {
      "nombre": "Usuario Ataque",
      "email": "ataque@hospital.com",
      "password": "ClaveSegura2026!",
      "rol": "administrador",
      "activo": false,
      "esSuperAdmin": true
    }

Respuesta: **201 Created**, con `rol: "paciente"` y `activo: true`.

Que devuelva 201 no significa que el ataque funcionara. Significa que la
petición era sintácticamente válida y que los campos de más se descartaron.

| El atacante pidió | El servidor guardó |
|---|---|
| `rol: "administrador"` | `rol: "paciente"` |
| `activo: false` | `activo: true` |
| `esSuperAdmin: true` | ni siquiera existe |

## Mass assignment completo (parte 12)

Se probó con todo lo que se pudo inventar:

    {
      "nombre": "Ataque Mass Assignment",
      "email": "mass@hospital.com",
      "password": "ClaveSegura2026!",
      "id": 9999,
      "rol": "administrador",
      "activo": false,
      "passwordHash": "HASH_CONTROLADO",
      "esSuperAdmin": true,
      "permisos": ["DELETE_ALL", "ADMIN"]
    }

Respuesta: **201**, con `id: 3`, `rol: "paciente"`, `activo: true`.

| El atacante pidió | El servidor guardó |
|---|---|
| `id: 9999` | `id: 3`, el siguiente que tocaba |
| `rol: "administrador"` | `rol: "paciente"` |
| `activo: false` | `activo: true` |
| `passwordHash: "HASH_CONTROLADO"` | hash bcrypt real de la contraseña |
| `esSuperAdmin: true` | no existe |
| `permisos: [...]` | no existe |

Lo del `passwordHash` se comprobó de la forma más directa posible: se hizo login
de ese usuario con la contraseña real y devolvió **200**. Si `HASH_CONTROLADO`
hubiera entrado, ninguna contraseña habría validado nunca contra él.

[Captura: el 201 del ataque, señalando rol paciente y activo true]

---

# Por qué 201 y no 400

Mandar `rol` no produce un error. Produce un **201 que lo ignora**. Y eso es
deliberado.

La API no va enumerando qué campos prohíbe, sino declarando qué campos acepta:
`nombre`, `email` y `password`. Todo lo demás se descarta por defecto, sin
necesidad de haberlo previsto. Eso es **allowlisting**, o lista blanca.

Una lista negra siempre se queda corta, porque obliga a acordarse de cada campo
peligroso uno por uno, y basta olvidar uno para abrir el agujero. La lista blanca
frena también lo que nadie había pensado: `permisos` no aparece en ninguna parte
del código de este proyecto, y aun así se cayó solo, sin que nadie escribiera una
regla para él.

**Enviar un atributo no significa tener autorización para controlarlo.**

---

# Checkpoint Bloque 4B

| | Prueba | Esperado | Obtenido |
|---|---|---|---|
| ✅ | Registro sin rol | 201 + `rol: "paciente"` | **201** + `rol: "paciente"` |
| ✅ | Registro con `rol: "administrador"` | 201 + `rol: "paciente"` | **201** + `rol: "paciente"` |
| ✅ | Enviar `activo: false` | se mantiene `true` | `activo: true` |
| ✅ | Enviar `passwordHash` falso | ignorado | hash bcrypt real, el login funciona |
| ✅ | Enviar `esSuperAdmin: true` | ignorado | el campo no existe |
| ✅ | Login con credenciales correctas | 200 | **200** "Autenticación correcta" |
| ✅ | Login con credenciales incorrectas | 401 | **401** "Credenciales inválidas" |

**Las siete pasan.** bcrypt sigue funcionando exactamente igual: el laboratorio
no tocó nada del hashing.

[Captura: la tabla del checkpoint con las siete pruebas en Postman]

---

# Swagger como documentación de seguridad

El schema `RegistroUsuario` dejó de anunciar `rol`. Quedó así:

    required:
      - nombre
      - email
      - password

Y la descripción del endpoint lo dice con todas las letras:

    Registra un nuevo usuario utilizando bcrypt para proteger la contraseña.
    El rol es asignado por el servidor y no puede ser definido por el cliente.

El motivo de cambiarlo no es cosmético. Si el schema siguiera anunciando `rol`,
estaría documentando una entrada que el servidor ya ignora, y cualquiera que
leyera el spec creería que puede elegir su rol. El contrato publicado tiene que
coincidir con el comportamiento real.

Así Swagger pasa a ser también documentación de la seguridad: quien lea el spec
sabe, sin abrir el código, que ese campo no es suyo.

`LoginUsuario` no cambió. El schema de respuesta tampoco: **sigue devolviendo
`rol`**, porque el rol sí sale en la respuesta aunque no entre en la petición.
Es el servidor quien lo dice.

`src/docs/swagger.js` no se tocó. El tag `Autenticación` ya estaba desde el
Lab 7.

## Los números del spec no se movieron

Se comprobó antes y después, porque no se añadieron ni quitaron rutas: solo
cambió el contenido de un schema.

    rutas (paths) : 17  ->  17
    endpoints     : 37  ->  37
    schemas       : 18  ->  18
    tags          :  7  ->   7

    referencias rotas: NINGUNA (17 $ref, todos resuelven)

---

# Semgrep y npm audit

**Semgrep**, mismo comando de siempre:

    Ran 73 rules on 40 files: 0 findings.

Cuadra exactamente con el Lab 7. En este laboratorio no se creó ningún archivo:
se modificaron tres (`auth.validator.js`, `usuarios.service.js` y
`auth.routes.js`) y se creó cero. El conteo confirma que no se coló nada.

| Laboratorio | Archivos | Hallazgos |
|---|---|---|
| Lab 5 — Bloque 2 | 29 | 0 |
| Lab 5 — Bloque 3 | 30 | 0 |
| Lab 6 | 34 | 0 |
| Lab 7 | 40 | 0 |
| **Lab 8** | **40** | **0** |

**npm audit**:

    found 0 vulnerabilities

Las mismas 9 dependencias directas del Lab 7, ni una más ni una menos. Se
comparó la lista entera: cero añadidas, cero quitadas. Era lo esperado, porque
en este laboratorio no se instaló nada.

Evidencias: `sast-semgrep-lab8.txt` y `sca-npm-audit-lab8.txt`.

---

# El console.log que había vuelto

Queda constancia aquí para que no parezca que se corrigió a escondidas.

Durante el Lab 7 se añadió temporalmente en `crearUsuario` un
`console.log("Hash generado:", nuevoUsuario.passwordHash)` para demostrar el
salt, y se retiró al terminar esa prueba. Al empezar este laboratorio, ese
`console.log` **estaba otra vez en el archivo**.

Se detectó al ir a modificar esa misma función y se avisó antes de tocarlo. Se
retiró en esta fase, por tres motivos:

1. El PDF del Lab 7 pide explícitamente que se quite.
2. Un log normal no debe contener hashes de credenciales. Los logs se copian, se
   mandan por correo y acaban en sitios donde no se controla quién los lee.
3. El informe del Lab 7, ya entregado, afirma que se quitó y que se verificó. El
   código estaba contradiciendo el entregable.

Verificación después de retirarlo: se reinició el servidor, se hizo un registro
nuevo (201) y el log quedó en **0 líneas** de "Hash generado" y **0** cadenas
`$2b$`.

También se revisó el resto del proyecto. Quedan cuatro `console.*` en `src/`:
tres en `app.js` con las URLs de arranque y uno en `errores.middleware.js` con
el error del servidor. Ninguno toca hashes ni credenciales.

---

# Lo que este laboratorio NO resuelve

Sin adornarlo.

**No se puede crear un administrador.** Ningún usuario puede nacer
administrador, que era el objetivo. Pero eso significa también que por el
registro público **no se puede crear uno de ninguna forma**. Falta la operación
administrativa que lo permita, y esa operación necesita JWT y control de rol
para saber quién la está pidiendo y comprobar que tiene derecho a hacerlo.

De dónde saldrá el primero: de un proceso controlado de inicialización o seed
cuando exista base de datos. Una migración o un script de arranque del lado del
servidor. Nunca del registro público.

**El rol sigue sin dar ni quitar acceso.** El campo existe, ahora lo controla el
servidor, y no sirve absolutamente para nada todavía. Un `paciente` autenticado
llama exactamente a los mismos endpoints que un `administrador`. La autorización
por rol no está implementada.

Dicho de otro modo: este laboratorio arregló **quién decide el rol**, no **qué
hace el rol**.

**Los usuarios siguen viviendo en memoria.** Se pierden en cada reinicio.

**Sigue sin haber token.** El login comprueba las credenciales y responde, pero
no devuelve nada que sirva para mantener la sesión.

---

# Resumen

| Antes (Lab 7) | Ahora (Lab 8) |
|---|---|
| El cliente elegía su rol | El servidor lo asigna |
| `body("rol").isIn(ROLES)` en el validador | `rol` no está en el contrato de entrada |
| `rol: datos.rol` en el service | `rol: ROL_POR_DEFECTO` |
| Swagger anunciaba `rol` como campo de entrada | El schema solo acepta nombre, email y password |
| Escalada de privilegios abierta | Cerrada, con dos defensas independientes |
| 37 endpoints | 37 endpoints |

# Archivos de evidencia

| Archivo | Qué contiene |
|---|---|
| `sast-semgrep-lab8.txt` | Semgrep tras el Lab 8, 40 archivos, 0 hallazgos |
| `sca-npm-audit-lab8.txt` | npm audit y npm ls, 9 dependencias |
| `informe-lab7-hospital.md` | Informe del laboratorio anterior |

# Pendiente

Llevar el cambio al proyecto del equipo, con documentación y capturas. Y después
JWT: decodificar un token y demostrar que codificado no es lo mismo que cifrado.
