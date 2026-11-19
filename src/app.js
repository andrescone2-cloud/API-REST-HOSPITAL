require(
  "dotenv"
).config();


const express =
  require(
    "express"
  );


const path =
  require(
    "path"
  );


const helmet =
  require(
    "helmet"
  );


const cors =
  require(
    "cors"
  );


const {
  rateLimit
} = require(
  "express-rate-limit"
);


const swaggerUi =
  require(
    "swagger-ui-express"
  );


const swaggerSpec =
  require(
    "./docs/swagger"
  );


// ========================================
// Rutas
// ========================================

const pacientesRoutes =
  require(
    "./routes/pacientes.routes"
  );


const especialidadesRoutes =
  require(
    "./routes/especialidades.routes"
  );


const medicosRoutes =
  require(
    "./routes/medicos.routes"
  );


const consultoriosRoutes =
  require(
    "./routes/consultorios.routes"
  );


const citasRoutes =
  require(
    "./routes/citas.routes"
  );


const habitacionesRoutes =
  require(
    "./routes/habitaciones.routes"
  );


const ingresosRoutes =
  require(
    "./routes/ingresos.routes"
  );


const historialRoutes =
  require(
    "./routes/historial.routes"
  );


const recetasRoutes =
  require(
    "./routes/recetas.routes"
  );


const seguridadRoutes =
  require(
    "./routes/seguridad.routes"
  );


const authRoutes =
  require(
    "./routes/auth.routes"
  );


const usuariosRoutes =
  require(
    "./routes/usuarios.routes"
  );



// ========================================
// Middleware de errores
// ========================================

const {
  rutaNoEncontrada,
  manejarError
} = require(
  "./middlewares/errores.middleware"
);


// ========================================
// Middleware de API Key
// ========================================

const validarApiKey =
  require(
    "./middlewares/apiKey.middleware"
  );


// ========================================
// Aplicación
// ========================================

const app =
  express();


const PORT =
  process.env.PORT ||
  3000;


// ========================================
// Seguridad
// ========================================

app.disable(
  "x-powered-by"
);


app.use(
  helmet()
);


// ========================================
// CORS
// ========================================

// ALLOWED_ORIGIN admite ahora una lista
// separada por comas: la SPA de Vite
// (5173) se sirve desde otro origen que la
// API, y en el futuro habra mas entornos.
//
// Se permite tambien la peticion sin Origin,
// que es la de curl, Postman o el propio
// Swagger servido por esta API.

const origenesPermitidos = (
  process.env.ALLOWED_ORIGIN || ""
)
  .split(",")
  .map((origen) => origen.trim())
  .filter(Boolean);


app.use(
  cors({

    origin: (origin, callback) => {

      if (
        !origin ||
        origenesPermitidos.includes(origin)
      ) {
        return callback(null, true);
      }

      // Un origen no permitido NO es un error
      // del servidor. Lanzar aqui convierte el
      // preflight en un 500: ensucia los logs y
      // deja que cualquiera provoque errores
      // mandando un Origin inventado.
      //
      // Con false se responde sin las cabeceras
      // CORS, que es justo lo que hace que el
      // navegador bloquee la peticion.
      return callback(null, false);
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE"
    ]
  })
);


// ========================================
// Limitar tamaño JSON
// ========================================

app.use(
  express.json({

    limit:
      "10kb"
  })
);


// ========================================
// Rate Limiting
// ========================================

const RATE_LIMIT_MAX =
  Number(
    process.env
      .RATE_LIMIT_MAX
  ) ||
  100;


const limiter =
  rateLimit({

    windowMs:
      15 *
      60 *
      1000,

    limit:
      RATE_LIMIT_MAX,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    message: {

      mensaje:
        "Demasiadas solicitudes. Intente nuevamente más tarde."
    }
  });


app.use(
  "/api",
  limiter
);


// ========================================
// API Key: barrera selectiva (Bloque 11)
//
// Hasta aqui la API Key cubria todo /api.
// Eso impide que un navegador consuma la
// API: la clave quedaria a la vista en el
// codigo de la SPA.
//
// A partir de ahora la API Key protege las
// integraciones privadas, y lo que consume
// el navegador se protege con JWT. El login
// queda publico, pero con validacion de
// entrada y rate limit.
// ========================================

const rutasRecursosJWT = new Set([
  "/pacientes",
  "/especialidades",
  "/medicos",
  "/consultorios",
  "/citas",
  "/habitaciones",
  "/ingresos",
  "/historial",
  "/recetas",
  "/usuarios"
]);

const rutasAuthJWT = new Set([
  "/auth/perfil",
  "/auth/cambiar-password",
  "/auth/recuperacion/admin",
  "/auth/codigos-recuperacion"
]);


app.use(
  "/api",

  (
    req,
    res,
    next
  ) => {

    // El preflight no lleva credenciales.
    //
    // Un OPTIONS es la pregunta que hace el
    // navegador ANTES de la peticion real, y
    // la manda sin cabeceras propias: exigirle
    // API Key es pedirle algo que por
    // definicion no puede traer.
    //
    // Quien decide si ese origen pasa es CORS,
    // mas arriba. Dejarlo seguir hasta aqui
    // solo convertia un preflight rechazado en
    // un 401 que no describe lo que ocurrio.
    //
    // No abre nada: la peticion real que venga
    // despues si atraviesa esta barrera.
    if (req.method === "OPTIONS") {
      return next();
    }


    // Login publico
    if (
      req.method === "POST" &&
      req.path === "/auth/login"
    ) {
      return next();
    }

    // Recursos protegidos por JWT en sus
    // propios routers
    const recurso =
      "/" + req.path.split("/")[1];

    if (rutasRecursosJWT.has(recurso)) {
      return next();
    }

    // Rutas de autenticacion con JWT
    const rutaAuth =
      "/" + req.path
        .split("/")
        .slice(1, 3)
        .join("/");

    if (rutasAuthJWT.has(rutaAuth)) {
      return next();
    }

    // El resto sigue exigiendo API Key
    return validarApiKey(req, res, next);
  }
);


// ========================================
// Interfaz web (frontend)
// ========================================

// Archivos estaticos de /public, en http://localhost:3000/app
// Mismo origen que la API: no necesita CORS. Los scripts van en
// archivos propios (sin codigo en linea) para cumplir la politica
// de seguridad de contenido (CSP) de Helmet.
app.use(
  "/app",
  express.static(
    path.join(__dirname, "..", "public")
  )
);


// ========================================
// Ruta principal
// ========================================

app.get(
  "/",

  (
    req,
    res
  ) => {

    res
      .status(200)
      .json({

        mensaje:
          "API Hospital funcionando"
      });
  }
);


// ========================================
// Recursos
// ========================================

app.use(
  "/api/pacientes",
  pacientesRoutes
);


app.use(
  "/api/especialidades",
  especialidadesRoutes
);


app.use(
  "/api/medicos",
  medicosRoutes
);


app.use(
  "/api/consultorios",
  consultoriosRoutes
);


app.use(
  "/api/citas",
  citasRoutes
);


app.use(
  "/api/habitaciones",
  habitacionesRoutes
);


app.use(
  "/api/ingresos",
  ingresosRoutes
);


app.use(
  "/api/historial",
  historialRoutes
);


app.use(
  "/api/recetas",
  recetasRoutes
);


app.use(
  "/api/seguridad",
  seguridadRoutes
);


app.use(
  "/api/auth",
  authRoutes
);


app.use(
  "/api/usuarios",
  usuariosRoutes
);


// ========================================
// Swagger
// ========================================

app.use(
  "/api-docs",

  swaggerUi.serve,

  swaggerUi.setup(
    swaggerSpec
  )
);


// ========================================
// OpenAPI JSON
// ========================================

app.get(
  "/openapi.json",

  (
    req,
    res
  ) => {

    res.json(
      swaggerSpec
    );
  }
);


// ========================================
// Ruta no encontrada
// ========================================

app.use(
  rutaNoEncontrada
);


// ========================================
// Manejo global de errores
// ========================================

app.use(
  manejarError
);


// ========================================
// Servidor
// ========================================

// ========================================
// Iniciar servidor
//
// Desde el Bloque 7.5.1 el arranque SOLO
// abre el puerto. La creacion del primer
// administrador se hace aparte, con
// "npm run seed:admin".
//
// Encender el edificio no vuelve a fabricar
// la llave maestra.
// ========================================

const iniciarServidor = () => {

  app.listen(
    PORT,

    () => {

      console.log(
        `Servidor ejecutándose en http://localhost:${PORT}`
      );

      console.log(
        `Swagger UI: http://localhost:${PORT}/api-docs`
      );

      console.log(
        `OpenAPI JSON: http://localhost:${PORT}/openapi.json`
      );
    }
  );
};


iniciarServidor();