# API REST para la gestión de un Hospital — Alineación con la especificación

Este documento resume qué se agregó para que la API cumpla la especificación del proyecto
**sin romper lo que ya funcionaba** (JWT, roles, API Key, RBAC, Swagger, pruebas de seguridad).

## 1. Aplicar la migración (una sola vez)

En el **SQL Editor de Supabase** ejecutar `database/04_migracion_especificacion.sql`.
Es idempotente (se puede repetir) y no borra datos. Hace lo siguiente:

| Cambio | Detalle |
|---|---|
| `pacientes` | Columnas `tipo_sangre` (A+, A-, B+, B-, AB+, AB-, O+, O-) y `alergias` |
| `medicos` | Columnas `documento` (único) y `estado` (`activo`, `inactivo`, `vacaciones`) |
| `citas` | El estado `atendida` pasa a `completada`; las filas existentes se convierten |
| `habitaciones` | Nueva: `numero` único, `piso`, `tipo` (UCI/General/Aislamiento), `estado` (disponible/ocupada/mantenimiento) |
| `ingresos` | Nueva: `paciente_id`, `habitacion_id`, `fecha_ingreso`, `fecha_alta`, `diagnostico` |
| Integridad | Índice único parcial: **máximo un ingreso activo por habitación** y por paciente; `CHECK fecha_alta >= fecha_ingreso` |
| Seguridad | RLS activado y `REVOKE` para `anon`/`authenticated`, igual que el resto de tablas |

Después reiniciar la API (`npm start`). No hay dependencias nuevas.

### Trazabilidad de ingresos (`database/05_trazabilidad_ingresos.sql`)

`ingresos` guarda además `registradoPor` (usuario que registró el ingreso), `altaPor` (usuario que dio el alta)
y `creadoEn`. Los valores salen del **JWT** (`req.usuario.id`); aunque el cliente los envíe en el cuerpo, se descartan.
Los ingresos creados antes de esta migración quedan con `registradoPor`/`altaPor` en `null`.
`node scripts/migrar-especificacion.js` aplica la 04 y la 05.

## 2. Recursos y atributos

| Recurso | Atributos |
|---|---|
| Pacientes | id, nombre, documento, telefono, **correo** (alias de `email`), **tipoSangre**, **alergias** (+ `fechaNacimiento`, `usuarioId` existentes) |
| Médicos | id, nombre, **documento**, **especialidad** (nombre; además `especialidadId`), **licenciaMedica** (alias de `registroMedico`), **correo** (alias de `email`), **estado** (+ `activo`, `telefono`) |
| Citas | id, pacienteId, medicoId, fecha, hora, motivo, estado: programada, confirmada, **completada**, cancelada (+ `consultorioId` existente) |
| Habitaciones | id, numero, piso, tipo, estado |
| Ingresos | id, pacienteId, habitacionId, fechaIngreso, fechaAlta, diagnostico (+ registradoPor, altaPor, creadoEn) |

**Compatibilidad:** las entradas aceptan tanto el nombre de la especificación (`correo`, `licenciaMedica`)
como el anterior (`email`, `registroMedico`); las respuestas incluyen ambos. La cita en estado
`atendida` sigue aceptándose en `PATCH /api/citas/:id/estado` y se guarda como `completada`.

## 3. Endpoints

| Recurso | Endpoints | Roles |
|---|---|---|
| Pacientes | GET/POST `/api/pacientes`, GET/PUT/DELETE `/api/pacientes/:id` | lectura: admin y médico; escritura: admin |
| Médicos | GET/POST `/api/medicos`, GET/PUT/DELETE `/api/medicos/:id` | sin cambios |
| Citas | GET/POST `/api/citas`, GET/PUT/DELETE `/api/citas/:id`, PATCH `/api/citas/:id/estado` | sin cambios |
| **Habitaciones** | GET/POST `/api/habitaciones`, GET `/api/habitaciones/disponibles`, GET/PUT `/api/habitaciones/:id` | lectura: admin y médico; escritura: admin |
| **Ingresos** | GET/POST `/api/ingresos`, PATCH `/api/ingresos/:id/dar-alta` (extra: GET `/api/ingresos/:id`, filtro `?activo=true|false`) | admin y médico |

Todas llevan `Authorization: Bearer <JWT>`. Documentación interactiva en `/api-docs`.

## 4. Reglas de negocio

| Regla | Dónde se cumple |
|---|---|
| Debe existir paciente y médico para una cita | `citas.controller` (ya existía) |
| Un médico no puede tener dos citas en la misma fecha y hora | validación + índice único `uq_citas_medico_horario` (ya existía) |
| No se asigna habitación ocupada o en mantenimiento | `ingresos.service.crearIngreso` → **409** |
| Máximo un ingreso activo por habitación | transacción con `SELECT … FOR UPDATE` + índice único parcial |
| Fecha de alta no anterior a la de ingreso | `ingresos.service.darAlta` → **400** + `CHECK` en BD |
| Al dar de alta, la habitación vuelve a `disponible` | misma transacción que el alta |
| Documento único (pacientes y médicos) / licencia única | validación + `UNIQUE` → **409** |
| No eliminar paciente con citas activas u hospitalización en curso | `pacientes.controller.eliminarPaciente` → **409** |

Notas de diseño:
- Una habitación con ingreso activo no puede cambiarse a `disponible`/`mantenimiento` por `PUT`, y `ocupada`
  no puede fijarse a mano: ese estado lo gobiernan los ingresos.
- Además de lo pedido, un paciente con **historial** (citas completadas/canceladas o ingresos con alta) tampoco se
  elimina, para no perder historiales clínicos (comportamiento que ya tenía la API para las citas).
- `fechaIngreso` y `fechaAlta` aceptan ISO 8601 (`2026-11-13` o `2026-11-13T14:30:00Z`); por defecto, el momento actual; no pueden ser futuras.

## 5. Validaciones

Correo con formato válido · nombres de 3 a 100 caracteres · documento y licencia obligatorios y únicos ·
estados permitidos (citas, habitaciones, médicos) · IDs enteros positivos · allowlist de campos con
`matchedData()` (anti Mass Assignment) en todos los recursos nuevos.

## 6. Casos de prueba (curl)

```bash
TOKEN="<jwt de administrador>"; H=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
API=http://localhost:3000/api
```

**Positivos**

```bash
# Registrar un paciente nuevo con datos válidos
curl "${H[@]}" -X POST $API/pacientes -d '{"nombre":"Laura Gómez","documento":"1020304050","correo":"laura@correo.com","telefono":"3001234567","fechaNacimiento":"1990-05-15","tipoSangre":"O+","alergias":"Penicilina"}'

# Programar una cita con un médico disponible
curl "${H[@]}" -X POST $API/citas -d '{"pacienteId":1,"medicoId":1,"consultorioId":1,"fecha":"2026-12-01","hora":"09:00","motivo":"Control general"}'

# Crear habitación y asignarla a un ingreso
curl "${H[@]}" -X POST $API/habitaciones -d '{"numero":"301","piso":3,"tipo":"General"}'
curl "${H[@]}" $API/habitaciones/disponibles
curl "${H[@]}" -X POST $API/ingresos -d '{"pacienteId":1,"habitacionId":1,"diagnostico":"Neumonía aguda"}'

# Dar de alta (la habitación vuelve a disponible)
curl "${H[@]}" -X PATCH $API/ingresos/1/dar-alta
curl "${H[@]}" $API/habitaciones/1
```

**Negativos** (resultado esperado entre paréntesis)

```bash
# Asignar una habitación ocupada (409)
curl "${H[@]}" -X POST $API/ingresos -d '{"pacienteId":2,"habitacionId":1,"diagnostico":"Fractura"}'

# Dos citas al mismo médico, misma fecha y hora (409)
curl "${H[@]}" -X POST $API/citas -d '{"pacienteId":2,"medicoId":1,"consultorioId":2,"fecha":"2026-12-01","hora":"09:00","motivo":"Dolor de cabeza"}'

# Médico con licencia duplicada (409)
curl "${H[@]}" -X POST $API/medicos -d '{"nombre":"Otro Médico","documento":"1111111111","licenciaMedica":"RM-45871","correo":"otro@hospital.com","telefono":"3100000000","especialidadId":1,"estado":"activo"}'

# Fecha de alta anterior a la de ingreso (400)
curl "${H[@]}" -X PATCH $API/ingresos/1/dar-alta -d '{"fechaAlta":"2000-01-01"}'

# Correo con formato inválido (400)
curl "${H[@]}" -X POST $API/pacientes -d '{"nombre":"Pedro Pérez","documento":"1234567890","correo":"no-es-correo","telefono":"3001112233","fechaNacimiento":"1985-01-01"}'
```
