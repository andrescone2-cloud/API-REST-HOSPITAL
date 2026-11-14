# SAST — Revisión manual de código

Proyecto: API_HOSPITAL
Fecha: 2026-09-20
Alcance: `src/` (29 archivos)
Complemento de: `sast-semgrep.txt` (Semgrep 1.172.0, 73 reglas, 0 hallazgos)

Semgrep no reporta hallazgos, pero las reglas automáticas no evalúan reglas de
negocio ni el uso correcto de las capas del proyecto. Esta revisión cubre los
cinco puntos pedidos por el laboratorio.

---

## 1. Uso de `req.body` sin `matchedData`

**Qué se buscó:** cualquier lectura directa de `req.body` en controllers o
services, que permitiría que un campo no declarado en el validator llegara
hasta la capa de datos (mass assignment).

**Comando:**

    grep -rn "req\.body" src/
    grep -rc "matchedData(" src/controllers/

**Resultado:** **0 ocurrencias de `req.body` en todo `src/`.**
Los cinco controllers usan exclusivamente `matchedData(req)`:

| Controller | Llamadas a `matchedData` |
|---|---|
| citas.controller.js | 4 |
| consultorios.controller.js | 3 |
| especialidades.controller.js | 3 |
| medicos.controller.js | 3 |
| pacientes.controller.js | 3 |

**Veredicto:** correcto. `matchedData` devuelve solo los campos que el validator
declaró, así que `id` y `estado` enviados por el cliente se descartan antes de
llegar al service. Confirmado empíricamente en la prueba 5 de lógica de negocio.

**Nota:** `req.params` sí se lee directo (24 ocurrencias), pero siempre en rutas
que montan un validator `param("id").isInt({min:1})` antes del controller, y el
valor se pasa a `Number(id)` en el service. No es explotable.

---

## 2. Concatenación de entrada del usuario

**Qué se buscó:** template literals o concatenación donde entre un valor
controlado por el cliente, y las funciones que convertirían eso en ejecución
(`eval`, `new Function`, `child_process`, `exec`), además de acceso a `fs`/`path`
con rutas de usuario (path traversal).

**Comando:**

    grep -rnE '`[^`]*\$\{[^}]*(req\.|id|datos|nombre|email)' src/
    grep -rnE "\beval\(|new Function|child_process|execSync|exec\(" src/

**Resultado:** ninguna ocurrencia en ninguno de los dos casos.

La única interpolación con dato del cliente es el mensaje de la máquina de
estados en `citas.controller.js:826`:

    `No se permite cambiar una cita de ${estadoActual} a ${nuevoEstado}`

Ambos valores están restringidos por el validator a un enum cerrado
(`programada | confirmada | atendida | cancelada`) y el destino es un campo JSON,
no HTML ni una query. No hay vector de inyección.

**Veredicto:** sin hallazgos. Al no haber base de datos todavía, tampoco hay
superficie de SQL injection; esto habrá que revisarlo de nuevo en el Bloque 10
cuando entre PostgreSQL/Supabase.

---

## 3. Secretos escritos en el código

**Qué se buscó:** claves, contraseñas o tokens literales en `src/`, y uso de
variables de entorno.

**Comando:**

    grep -rniE "(api[_-]?key|secret|password|passwd|token|apikey|authorization)\s*[:=]" src/
    grep -rn "process\.env" src/

**Resultado:** **0 secretos hardcodeados.** Solo dos lecturas de entorno:

- `src/app.js:98` → `process.env.PORT`
- `src/app.js:124` → `process.env.ALLOWED_ORIGIN`

`.env` está listado en `.gitignore` y `.env.example` no contiene valores reales.

**Veredicto:** correcto. Este punto habrá que repetirlo tras el Bloque 3, cuando
entre `API_KEY` al `.env`, verificando que no se registre en logs.

---

## 4. Información sensible en los mensajes de error

**Qué se buscó:** stack traces, rutas del sistema de archivos, nombres de
dependencias o datos internos devueltos al cliente.

**Archivo revisado:** `src/middlewares/errores.middleware.js`

**Resultado:** el handler global captura el error, lo manda a `console.error`
(servidor) y responde al cliente solo con:

    { "mensaje": "Error interno del servidor" }

Nunca se serializa `error.stack` ni `error.message` hacia el cliente. El 404 de
ruta responde solo `"Ruta no encontrada"`. `app.disable("x-powered-by")` está
activo y helmet añade las cabeceras de seguridad.

**Veredicto:** correcto, con una observación menor.

**Observación (informativa, severidad baja):** `validar.middleware.js` devuelve
`errores.array()` completo de express-validator, lo que incluye el campo `value`
con el dato que envió el cliente. Ejemplo real:

    DELETE /api/especialidades/abc
    { "mensaje": "Datos de entrada inválidos",
      "errores": [{ "type":"field", "value":"abc", "msg":"El id debe ser un número
        entero positivo", "path":"id", "location":"params" }] }

Solo devuelve el eco de lo que el propio cliente mandó, así que hoy no filtra
nada del servidor. Conviene tenerlo presente para cuando existan campos
sensibles (contraseñas en el Bloque 4): ahí `value` sí mostraría el secreto en
la respuesta de error.

---

## 5. Endpoints sin validación

**Qué se buscó:** rutas que llegan al controller sin cadena de validators y sin
el middleware `validar`.

**Comando:**

    grep -nE "router\.(get|post|put|patch|delete)" src/routes/*.routes.js

**Resultado:** 34 operaciones en 14 rutas. Todas las que reciben entrada
(`param` o `body`) montan su validator + `validar` antes del controller.

Las únicas sin validator son los 5 GET de colección, que no reciben ningún
parámetro:

- `GET /api/pacientes`
- `GET /api/especialidades`
- `GET /api/medicos`
- `GET /api/consultorios`
- `GET /api/citas`

**Veredicto:** correcto. No hay endpoint con entrada sin validar.

---

## Resumen

| # | Punto revisado | Resultado |
|---|---|---|
| 1 | `req.body` sin `matchedData` | Sin hallazgos (0 usos de `req.body`) |
| 2 | Concatenación de entrada de usuario | Sin hallazgos |
| 3 | Secretos en el código | Sin hallazgos |
| 4 | Info sensible en errores | Sin hallazgos / 1 observación baja (`value` en errores de validación) |
| 5 | Endpoints sin validación | Sin hallazgos |

**Hallazgo abierto fuera de esta lista:** el rate limit de `src/app.js` está
fijo en el código (`windowMs: 15*60*1000`, `limit: 100`), no se lee de `.env`.
No es una vulnerabilidad, pero bloqueará el Active Scan de ZAP con 429.
Ver `dast-preparacion.md`.
