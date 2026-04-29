import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'BildyApp API',
      version:     '1.0.0',
      description: 'API REST para la gestion de albaranes — BildyApp',
      contact: {
        name: 'BildyApp',
      },
    },
    servers: [
      { url: process.env.PUBLIC_URL || 'http://localhost:3000', description: 'Servidor activo' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id:        { type: 'string' },
            email:     { type: 'string', format: 'email' },
            name:      { type: 'string' },
            lastName:  { type: 'string' },
            nif:       { type: 'string' },
            role:      { type: 'string', enum: ['admin', 'user'] },
            status:    { type: 'string', enum: ['pending', 'verified'] },
            companyId: { type: 'string', description: 'ID de la compania' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Company: {
          type: 'object',
          properties: {
            id:          { type: 'string' },
            name:        { type: 'string' },
            cif:         { type: 'string' },
            isFreelance: { type: 'boolean' },
            logoUrl:     { type: 'string' },
          },
        },
        Client: {
          type: 'object',
          properties: {
            id:      { type: 'string' },
            name:    { type: 'string' },
            cif:     { type: 'string' },
            email:   { type: 'string' },
            phone:   { type: 'string' },
            address: { $ref: '#/components/schemas/Address' },
            deleted: { type: 'boolean' },
          },
        },
        ClientInput: {
          type: 'object',
          required: ['name', 'cif'],
          properties: {
            name:    { type: 'string', example: 'Empresa ABC SL' },
            cif:     { type: 'string', example: 'B12345678' },
            email:   { type: 'string', format: 'email' },
            phone:   { type: 'string' },
            address: { $ref: '#/components/schemas/Address' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id:          { type: 'string' },
            name:        { type: 'string' },
            projectCode: { type: 'string' },
            clientId:    { type: 'string' },
            active:      { type: 'boolean' },
            deleted:     { type: 'boolean' },
          },
        },
        ProjectInput: {
          type: 'object',
          required: ['client', 'name', 'projectCode'],
          properties: {
            client:      { type: 'string', description: 'ID del cliente' },
            name:        { type: 'string', example: 'Reforma oficinas' },
            projectCode: { type: 'string', example: 'PRJ-001' },
            address:     { $ref: '#/components/schemas/Address' },
            email:       { type: 'string', format: 'email' },
            notes:       { type: 'string' },
            active:      { type: 'boolean', default: true },
          },
        },
        DeliveryNote: {
          type: 'object',
          properties: {
            id:          { type: 'string' },
            format:      { type: 'string', enum: ['material', 'hours'] },
            description: { type: 'string' },
            workDate:    { type: 'string', format: 'date' },
            signed:      { type: 'boolean' },
            signedAt:    { type: 'string', format: 'date-time' },
            signatureUrl:{ type: 'string' },
            pdfUrl:      { type: 'string' },
          },
        },
        DeliveryNoteInput: {
          type: 'object',
          required: ['client', 'project', 'format', 'workDate'],
          properties: {
            client:      { type: 'string', description: 'ID del cliente' },
            project:     { type: 'string', description: 'ID del proyecto' },
            format:      { type: 'string', enum: ['material', 'hours'] },
            description: { type: 'string' },
            workDate:    { type: 'string', format: 'date', example: '2025-06-15' },
            material:    { type: 'string', description: 'Obligatorio si format=material' },
            quantity:    { type: 'number' },
            unit:        { type: 'string' },
            hours:       { type: 'number', description: 'Obligatorio si format=hours y sin workers' },
            workers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name:  { type: 'string' },
                  hours: { type: 'number' },
                },
              },
            },
          },
        },
        Address: {
          type: 'object',
          properties: {
            street:   { type: 'string' },
            number:   { type: 'string' },
            postal:   { type: 'string' },
            city:     { type: 'string' },
            province: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error:   { type: 'boolean', example: true },
            message: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
