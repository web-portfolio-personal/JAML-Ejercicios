import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Library API',
      version: '1.0.0',
      description: 'API REST para biblioteca digital — Supabase + Prisma, JWT, roles (USER | LIBRARIAN | ADMIN)'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Servidor de desarrollo' }
    ],
    components: {
      securitySchemes: {
        BearerToken: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Juan Pérez' },
            email: { type: 'string', format: 'email', example: 'juan@example.com' },
            role: { type: 'string', enum: ['USER', 'LIBRARIAN', 'ADMIN'], example: 'USER' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Book: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            isbn: { type: 'string', example: '978-0-7432-7356-5' },
            title: { type: 'string', example: 'The Great Gatsby' },
            author: { type: 'string', example: 'F. Scott Fitzgerald' },
            genre: { type: 'string', example: 'Fiction' },
            description: { type: 'string' },
            publishedYear: { type: 'integer', example: 1925 },
            copies: { type: 'integer', example: 5 },
            available: { type: 'integer', example: 3 }
          }
        },
        BookInput: {
          type: 'object',
          required: ['isbn', 'title', 'author', 'genre', 'publishedYear', 'copies'],
          properties: {
            isbn: { type: 'string', example: '978-0-7432-7356-5' },
            title: { type: 'string', example: 'The Great Gatsby' },
            author: { type: 'string', example: 'F. Scott Fitzgerald' },
            genre: { type: 'string', example: 'Fiction' },
            description: { type: 'string' },
            publishedYear: { type: 'integer', example: 1925 },
            copies: { type: 'integer', example: 5 }
          }
        },
        Loan: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            userId: { type: 'integer', example: 1 },
            bookId: { type: 'integer', example: 1 },
            loanDate: { type: 'string', format: 'date-time' },
            dueDate: { type: 'string', format: 'date-time' },
            returnDate: { type: 'string', format: 'date-time', nullable: true },
            status: { type: 'string', enum: ['ACTIVE', 'RETURNED', 'OVERDUE'] }
          }
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            userId: { type: 'integer', example: 1 },
            bookId: { type: 'integer', example: 1 },
            rating: { type: 'integer', minimum: 1, maximum: 5, example: 4 },
            comment: { type: 'string', example: 'Muy buen libro' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { '$ref': '#/components/schemas/User' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Mensaje de error' }
          }
        }
      },
      responses: {
        Error: {
          description: 'Error',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

export default swaggerJsdoc(options);
