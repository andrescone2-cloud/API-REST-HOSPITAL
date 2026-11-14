# Pruebas manuales de lógica de negocio

Proyecto: API_HOSPITAL
Fecha: 2026-09-20
Base: `http://localhost:3000`

Son las cinco pruebas que ni SCA, ni SAST ni DAST detectan: dependen de las
reglas del negocio, no de patrones de código.

Estado inicial relevante:

| Cita | pacienteId | medicoId | consultorioId | fecha | hora | estado |
|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 2 | 2026-09-15 | 10:30 | programada |
| 2 | 2 | 2 | 4 | 2026-09-15 | 11:00 | confirmada |
| 3 | 3 | 3 | 1 | 2026-09-16 | 09:00 | programada |

Los 3 médicos del seed tienen `activo: true`.

---

## Prueba 1 — Crear una cita que nazca en estado "atendida"

**Debería pasar:** el cliente no decide el estado. La cita nace `programada`.

**Petición**

    POST /api/citas
    Content-Type: application/json

    {"pacienteId":2,"medicoId":2,"consultorioId":3,"fecha":"2026-10-01",
     "hora":"08:00","motivo":"Intento de nacer atendida","estado":"atendida"}

**Respuesta — HTTP 201**

    {"mensaje":"Cita creada correctamente",
     "cita":{"id":4,"pacienteId":2,"medicoId":2,"consultorioId":3,
             "fecha":"2026-10-01","hora":"08:00",
             "motivo":"Intento de nacer atendida","estado":"programada"}}

**Resultado:** CONTROLADO. El `estado:"atendida"` se descartó silenciosamente y
la cita nació `programada`.

**Mecanismo:** `citas.validator.js` no declara `body("estado")` en
`validarCreacionCita`, y el controller lee con `matchedData(req)`, que solo
devuelve campos declarados. El estado lo fija el service (`citas.service.js`,
"La cita siempre nace programada").

---

## Prueba 2 — Pasar una cita de "atendida" a "programada"

**Debería pasar:** 409. `atendida` es un estado terminal.

**Preparación** (transiciones legítimas sobre la cita 4):

    PATCH /api/citas/4/estado {"estado":"confirmada"}  -> 200
    PATCH /api/citas/4/estado {"estado":"atendida"}    -> 200

**Petición**

    PATCH /api/citas/4/estado
    {"estado":"programada"}

**Respuesta — HTTP 409**

    {"mensaje":"No se permite cambiar una cita de atendida a programada"}

**Resultado:** CONTROLADO.

**Mecanismo:** máquina de estados explícita en `citas.controller.js:787-801`:

    programada  -> [confirmada, cancelada]
    confirmada  -> [atendida, cancelada]
    atendida    -> []
    cancelada   -> []

`atendida` y `cancelada` son terminales.

---

## Prueba 3 — Asignar una cita a un médico inactivo

**Debería pasar:** 409. No se agenda con un médico dado de baja.

**Preparación:** todos los médicos del seed están activos, así que se crea uno
inactivo.

    POST /api/medicos
    {"nombre":"Medico Inactivo Prueba","registroMedico":"RM-99999",
     "email":"inactivo@hospital.com","telefono":"3001112233",
     "especialidadId":1,"activo":false}
    -> 201, id: 4

**Petición**

    POST /api/citas
    {"pacienteId":3,"medicoId":4,"consultorioId":3,"fecha":"2026-10-02",
     "hora":"15:00","motivo":"Cita con medico inactivo"}

**Respuesta — HTTP 409**

    {"mensaje":"No se pueden programar citas con un médico inactivo"}

**Resultado:** CONTROLADO.

**Mecanismo:** `citas.controller.js:83-89` comprueba `!medico.activo` antes de
crear. Hay un control equivalente para consultorio inactivo (líneas 145-151).

---

## Prueba 4 — Ocupar dos veces el mismo consultorio en la misma fecha y hora

**Debería pasar:** 409. Un consultorio no se ocupa dos veces en el mismo slot.

**Petición** (la cita 1 ya ocupa consultorio 2 el 2026-09-15 a las 10:30)

    POST /api/citas
    {"pacienteId":3,"medicoId":3,"consultorioId":2,"fecha":"2026-09-15",
     "hora":"10:30","motivo":"Doble reserva del mismo consultorio"}

**Respuesta — HTTP 409**

    {"mensaje":"El consultorio ya está ocupado en esa fecha y hora"}

**Resultado:** CONTROLADO.

**Variante — mismo médico, consultorio distinto y libre**

    POST /api/citas
    {"pacienteId":3,"medicoId":1,"consultorioId":3,"fecha":"2026-09-15",
     "hora":"10:30","motivo":"Doble reserva del mismo medico"}

    HTTP 409
    {"mensaje":"El médico ya tiene una cita programada en esa fecha y hora"}

**Resultado:** CONTROLADO también.

**Mecanismo:** `consultorioTieneConflicto()` y `medicoTieneConflicto()` en
`citas.service.js`. No confundirlas con `consultorioTieneCitas()` /
`medicoTieneCitas()` del Bloque 1: las de conflicto filtran por fecha+hora y
excluyen canceladas; las de integridad referencial no filtran por estado.

---

## Prueba 5 — Modificar campos no permitidos (`id`, `estado` en el cuerpo)

**Debería pasar:** los campos no declarados se ignoran. `id` y `estado` no se
tocan por PUT/PATCH genéricos.

### 5a) PUT con `id` y `estado` inyectados

    PUT /api/citas/3
    {"id":999,"estado":"atendida","pacienteId":3,"medicoId":3,
     "consultorioId":1,"fecha":"2026-09-16","hora":"09:00",
     "motivo":"Intento de mass assignment via PUT"}

**Respuesta — HTTP 200**

    {"mensaje":"Cita actualizada correctamente",
     "cita":{"id":3,...,"motivo":"Intento de mass assignment via PUT",
             "estado":"programada"}}

`id` sigue siendo 3. `estado` sigue siendo `programada`.

### 5b) PATCH con `id` y `estado` inyectados

    PATCH /api/citas/3
    {"id":888,"estado":"cancelada","motivo":"Intento de mass assignment via PATCH"}

**Respuesta — HTTP 200**

    {"mensaje":"Cita actualizada parcialmente",
     "cita":{"id":3,...,"motivo":"Intento de mass assignment via PATCH",
             "estado":"programada"}}

`id` sigue siendo 3. `estado` sigue siendo `programada`.

### 5c) PATCH sobre otro recurso, con `id` inyectado

    PATCH /api/pacientes/2
    {"id":777,"telefono":"3009998877"}

**Respuesta — HTTP 200**

    {"mensaje":"Paciente actualizado parcialmente",
     "paciente":{"id":2,"nombre":"Carlos Ramírez","documento":"1098765432",
                 "email":"carlos@correo.com","telefono":"3009998877",
                 "fechaNacimiento":"1985-11-22"}}

`id` sigue siendo 2. Solo cambió `telefono`.

**Resultado:** CONTROLADO en los tres casos.

**Mecanismo:** `matchedData(req)` + validators que no declaran `id` ni `estado`,
y services que reconstruyen el objeto conservando `id` y `estado` del registro
actual en lugar de hacer spread del body. El único camino para cambiar el estado
es `PATCH /api/citas/{id}/estado`, que sí valida la transición.

---

## Resumen

| # | Prueba | Esperado | Obtenido | ¿Ya estaba controlado? |
|---|---|---|---|---|
| 1 | Cita que nace "atendida" | estado ignorado | 201, nace `programada` | Sí |
| 2 | atendida → programada | 409 | 409 | Sí |
| 3 | Cita con médico inactivo | 409 | 409 | Sí |
| 4 | Doble reserva de consultorio | 409 | 409 | Sí |
| 4b | Doble reserva de médico | 409 | 409 | Sí |
| 5 | Mass assignment (`id`, `estado`) | campos ignorados | 200, campos intactos | Sí |

**Las cinco estaban controladas.** No hubo que arreglar nada.

Nota: estas pruebas modifican el almacenamiento en memoria (cita 4 creada y
llevada a `atendida`, médico 4 creado inactivo, motivos y teléfono cambiados).
Todo se revierte al reiniciar el servidor.
