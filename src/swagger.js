import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "College Cafeteria Booking Backend",
      version: "1.0.0",
      description: "API Documentation for Cafeteria Food Ordering System"
    },
    servers: [
      { url: "http://localhost:4000" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  },

  apis: ["./src/routes/*.js"] // <-- Reads API docs from routes automatically
};

export const swaggerSpec = swaggerJsDoc(swaggerOptions);
export const swaggerUiServe = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(swaggerSpec);
