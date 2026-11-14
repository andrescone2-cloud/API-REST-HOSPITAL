const swaggerJsdoc =
  require(
    "swagger-jsdoc"
  );


const options = {

  definition: {

    openapi:
      "3.0.3",


    info: {

      title:
        "API Hospital Segura",

      version:
        "1.0.0",

      description:
        "API REST para la gestión hospitalaria desarrollada con Node.js y Express, incorporando prácticas seguras, autenticación mediante API Key y JWT, autorización basada en roles (RBAC) y documentación OpenAPI."
    },


    servers: [
      {
        url:
          "http://localhost:3000",

        description:
          "Servidor local"
      }
    ],


    components: {

      securitySchemes: {

        ApiKeyAuth: {

          type:
            "apiKey",

          in:
            "header",

          name:
            "X-API-Key",

          description:
            "API Key para integraciones y clientes privados."
        },


        BearerAuth: {

          type:
            "http",

          scheme:
            "bearer",

          bearerFormat:
            "JWT",

          description:
            "JWT obtenido mediante el endpoint de login."
        }
      }
    },


    // Bloque 11: ya no hay una exigencia
    // global de API Key.
    //
    // Antes, este bloque declaraba ApiKeyAuth
    // para toda la API. Con la barrera
    // selectiva eso seria mentira: el login
    // es publico y los recursos van con JWT.
    //
    // Vacio aqui, y cada operacion declara la
    // credencial que de verdad exige.
    security: [],


    tags: [

      {
        name:
          "Pacientes",

        description:
          "Gestión de pacientes"
      },

      {
        name:
          "Especialidades",

        description:
          "Gestión de especialidades médicas"
      },

      {
        name:
          "Médicos",

        description:
          "Gestión de médicos y asociación con especialidades"
      },

      {
        name:
          "Consultorios",

        description:
          "Gestión de consultorios del hospital"
      },

      {
        name:
          "Citas",

        description:
          "Programación, modificación y gestión del estado de las citas médicas"
      },

      {
        name:
          "Habitaciones",

        description:
          "Gestión de habitaciones y consulta de disponibilidad"
      },

      {
        name:
          "Ingresos",

        description:
          "Ingresos hospitalarios y altas de pacientes"
      },

      {
        name:
          "Seguridad",

        description:
          "Endpoints relacionados con autenticación y seguridad de la API"
      },

      {
        name:
          "Autenticación",

        description:
          "Registro e inicio de sesión de usuarios"
      },

      {
        name:
          "Usuarios",

        description:
          "Gestión administrativa de usuarios del sistema"
      }

    ]
  },


  apis: [
    "./src/routes/*.js"
  ]
};


const swaggerSpec =
  swaggerJsdoc(
    options
  );


module.exports =
  swaggerSpec;