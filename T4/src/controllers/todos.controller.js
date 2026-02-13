// src/controllers/todos.controller.js
import { todos, generateUUID } from '../data/todos.js';
import { ApiError } from '../middleware/errorHandler.js';

// GET /api/todos - Listar todas las tareas (con filtros)
export const getAll = (req, res) => {
    let resultado = [...todos];
    const { completed, priority, tag, sortBy, order, search } = req.query;

    // BONUS: Búsqueda fuzzy en título
    if (search) {
        const searchLower = search.toLowerCase();
        resultado = resultado.filter(todo =>
            todo.title.toLowerCase().includes(searchLower) ||
            (todo.description && todo.description.toLowerCase().includes(searchLower))
        );
    }

    // Filtrar por completada
    if (completed !== undefined) {
        const isCompleted = completed === 'true';
        resultado = resultado.filter(todo => todo.completed === isCompleted);
    }

    // Filtrar por prioridad
    if (priority) {
        resultado = resultado.filter(todo => todo.priority === priority);
    }

    // Filtrar por tag
    if (tag) {
        resultado = resultado.filter(todo =>
            todo.tags && todo.tags.includes(tag)
        );
    }

    // Ordenar
    if (sortBy) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };

        resultado.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'dueDate':
                    // Tareas sin fecha van al final
                    if (!a.dueDate && !b.dueDate) comparison = 0;
                    else if (!a.dueDate) comparison = 1;
                    else if (!b.dueDate) comparison = -1;
                    else comparison = new Date(a.dueDate) - new Date(b.dueDate);
                    break;
                case 'createdAt':
                    comparison = new Date(a.createdAt) - new Date(b.createdAt);
                    break;
                case 'priority':
                    comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
                    break;
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
            }

            return order === 'desc' ? -comparison : comparison;
        });
    }

    res.json({
        total: resultado.length,
        data: resultado
    });
};

// GET /api/todos/stats - BONUS: Estadísticas
export const getStats = (req, res) => {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const pending = total - completed;

    const byPriority = {
        high: todos.filter(t => t.priority === 'high').length,
        medium: todos.filter(t => t.priority === 'medium').length,
        low: todos.filter(t => t.priority === 'low').length
    };

    const overdue = todos.filter(t =>
        !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
    ).length;

    // Tags más usados
    const tagCounts = {};
    todos.forEach(t => {
        if (t.tags) {
            t.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });

    res.json({
        total,
        completed,
        pending,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        byPriority,
        overdue,
        topTags: Object.entries(tagCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([tag, count]) => ({ tag, count }))
    });
};

// GET /api/todos/:id - Obtener una tarea específica
export const getById = (req, res) => {
    const { id } = req.params;
    const todo = todos.find(t => t.id === id);

    if (!todo) {
        throw ApiError.notFound(`Tarea con ID ${id} no encontrada`);
    }

    res.json(todo);
};

// POST /api/todos - Crear nueva tarea
export const create = (req, res) => {
    const { title, description, priority, completed, dueDate, tags } = req.body;

    const nuevaTarea = {
        id: generateUUID(),
        title,
        description: description || null,
        priority,
        completed: completed || false,
        dueDate: dueDate || null,
        tags: tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    todos.push(nuevaTarea);

    res.status(201).json(nuevaTarea);
};

// PUT /api/todos/:id - Actualizar tarea completa
export const update = (req, res) => {
    const { id } = req.params;
    const index = todos.findIndex(t => t.id === id);

    if (index === -1) {
        throw ApiError.notFound(`Tarea con ID ${id} no encontrada`);
    }

    const { title, description, priority, completed, dueDate, tags } = req.body;

    todos[index] = {
        id,
        title,
        description: description || null,
        priority,
        completed: completed !== undefined ? completed : todos[index].completed,
        dueDate: dueDate || null,
        tags: tags || [],
        createdAt: todos[index].createdAt,
        updatedAt: new Date().toISOString()
    };

    res.json(todos[index]);
};

// PATCH /api/todos/:id/toggle - Cambiar estado de completada
export const toggle = (req, res) => {
    const { id } = req.params;
    const index = todos.findIndex(t => t.id === id);

    if (index === -1) {
        throw ApiError.notFound(`Tarea con ID ${id} no encontrada`);
    }

    todos[index] = {
        ...todos[index],
        completed: !todos[index].completed,
        updatedAt: new Date().toISOString()
    };

    res.json({
        mensaje: `Tarea marcada como ${todos[index].completed ? 'completada' : 'pendiente'}`,
        data: todos[index]
    });
};

// PATCH /api/todos/:id - Actualización parcial
export const partialUpdate = (req, res) => {
    const { id } = req.params;
    const index = todos.findIndex(t => t.id === id);

    if (index === -1) {
        throw ApiError.notFound(`Tarea con ID ${id} no encontrada`);
    }

    todos[index] = {
        ...todos[index],
        ...req.body,
        updatedAt: new Date().toISOString()
    };

    res.json(todos[index]);
};

// DELETE /api/todos/:id - Eliminar tarea
export const remove = (req, res) => {
    const { id } = req.params;
    const index = todos.findIndex(t => t.id === id);

    if (index === -1) {
        throw ApiError.notFound(`Tarea con ID ${id} no encontrada`);
    }

    const deleted = todos.splice(index, 1)[0];

    res.status(200).json({
        mensaje: 'Tarea eliminada correctamente',
        data: deleted
    });
};
