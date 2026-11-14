# DAST — Preparación para OWASP ZAP

Proyecto: API_HOSPITAL
Fecha: 2026-09-20

## API levantada

    node src/app.js
    Servidor ejecutándose en http://localhost:3000
    Swagger UI: http://localhost:3000/api-docs
    OpenAPI JSON: http://localhost:3000/openapi.json

## /openapi.json

    GET http://localhost:3000/openapi.json
    HTTP 200 | 22294 bytes | application/json; charset=utf-8
    openapi: 3.0.3

- **14 rutas (paths)**
- **34 endpoints (path + método)**
- `components.securitySchemes`: ninguno
- `security` global: ninguno

Inventario:

| Métodos | Ruta |
|---|---|
| GET POST | /api/citas |
| GET | /api/citas/medico/{medicoId} |
| GET | /api/citas/paciente/{pacienteId} |
| DELETE GET PATCH PUT | /api/citas/{id} |
| PATCH | /api/citas/{id}/estado |
| GET POST | /api/consultorios |
| DELETE GET PATCH PUT | /api/consultorios/{id} |
| GET POST | /api/especialidades |
| DELETE GET PATCH PUT | /api/especialidades/{id} |
| GET POST | /api/medicos |
| GET | /api/medicos/especialidad/{especialidadId} |
| DELETE GET PATCH PUT | /api/medicos/{id} |
| GET POST | /api/pacientes |
| DELETE GET PATCH PUT | /api/pacientes/{id} |

El spec todavía no declara `securitySchemes`. Eso lo añade el Bloque 3 (PARTE 3H),
cuando Swagger tenga que enviar `X-API-Key`.

## Rate limit — parametrizado por variable de entorno

**Estado original:** estaba fijo en el código (`limit: 100`), sin leer entorno.
Con 100 peticiones por ventana de 15 minutos sobre todo `/api`, un Active Scan
de ZAP sobre 34 endpoints se llenaba de 429 y el informe quedaba lleno de falsos
negativos: ZAP no distingue "endpoint seguro" de "endpoint que me cortó el rate
limiter".

**Cambio aplicado** en `src/app.js`, sección Rate Limiting:

    const RATE_LIMIT_MAX =
      Number(
        process.env
          .RATE_LIMIT_MAX
      ) ||
      100;


    const limiter =
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: RATE_LIMIT_MAX,
        ...
      });

Y en `.env` / `.env.example`:

    RATE_LIMIT_MAX=100

El valor de servicio sigue siendo 100. Para escanear se sube **solo en la
terminal del escaneo**, nunca editando el código:

    RATE_LIMIT_MAX=100000 npm run dev

Al cerrar esa terminal la API vuelve a 100. Es lo contrario de editar el
`limit` en `app.js`, que es el cambio que se queda olvidado en el repositorio y
deja la API sin protección.

### Verificación

**1. Modo normal (`npm run dev`, RATE_LIMIT_MAX=100 desde .env)**

    Cabecera: RateLimit-Policy: "100-in-15min"; q=100; w=900

    110 peticiones GET /api/pacientes
      200 OK : 97
      429    : 13
      primer 429 en la nº 98 del lote (nº 101 contando las 3 previas)

    {"mensaje":"Demasiadas solicitudes. Intente nuevamente más tarde."}

El control sigue activo.

**2. Modo escaneo (`RATE_LIMIT_MAX=100000 npm run dev`)**

    Cabecera: RateLimit-Policy: "100000-in-15min"; q=100000; w=900

    150 peticiones GET /api/pacientes
      200 OK : 150
      429    : 0
      otros  : 0

Sin 429. Apto para el Active Scan.

Detalle: en modo normal el arranque reporta `injected env (3) from .env`; con el
override reporta `injected env (2)`, porque dotenv no pisa una variable que ya
existe en `process.env`. La de la terminal gana, que es justo lo que se busca.

## Plan de automatizacion

`dast-zap-plan.yaml` (en esta misma carpeta) automatiza el escaneo completo:
import de OpenAPI -> passive wait -> active scan -> passive wait -> 3 informes.

Lanzarlo desde la carpeta de instalacion de ZAP:

    cd "C:\Program Files\ZAP\Zed Attack Proxy"
    .\zap.bat -cmd -autorun "<ruta-del-proyecto>\docs\seguridad\dast-zap-plan.yaml"

Los informes se escriben junto al plan, en `docs/seguridad/`:
`dast-zap-reporte.html`, `.json` y `.md`.

## Pendiente (lo corre el usuario)

- Importar `http://localhost:3000/openapi.json` en ZAP
- Passive Scan
- Active Scan
