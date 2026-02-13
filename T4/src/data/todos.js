// src/data/todos.js
import crypto from 'crypto';

// Función para generar UUID
export const generateUUID = () => crypto.randomUUID();

// Datos iniciales de ejemplo
export const todos = [
    {
        id: generateUUID(),
        title: 'Completar ejercicio T4',
        description: 'Crear API de tareas con Express y Zod',
        priority: 'high',
        completed: false,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días desde ahora
        tags: ['trabajo', 'programacion'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: generateUUID(),
        title: 'Revisar documentación de Zod',
        description: 'Estudiar validación avanzada',
        priority: 'medium',
        completed: true,
        dueDate: null,
        tags: ['estudio'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: generateUUID(),
        title: 'Hacer deploy del proyecto',
        description: null,
        priority: 'low',
        completed: false,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 días desde ahora
        tags: ['trabajo', 'devops', 'urgente'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];
