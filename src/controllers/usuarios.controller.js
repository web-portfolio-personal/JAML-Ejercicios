// src/controllers/usuarios.controller.js
import { usuarios } from '../data/usuarios.js';
import { ApiError } from '../middleware/errorHandler.js';

// GET /api/usuarios
export const getAll = (req, res) => {
    let resultado = [...usuarios];
    const { nivel, orden } = req.query;

    // Filtrar por nivel
    if (nivel) {
        resultado = resultado.filter(u => u.nivel === nivel);
    }

    // Ordenar
    if (orden === 'name') {
        resultado.sort((a, b) => a.name.localeCompare(b.name));
    } else if (orden === 'nivel') {
        const ordenNivel = { 'junior': 1, 'mid-senior': 2, 'senior': 3 };
        resultado.sort((a, b) => ordenNivel[a.nivel] - ordenNivel[b.nivel]);
    }

    res.json(resultado);
};

// GET /api/usuarios/:id
export const getById = (req, res) => {
    const id = parseInt(req.params.id);
    const usuario = usuarios.find(u => u.id === id);

    if (!usuario) {
        throw ApiError.notFound(`Usuario con ID ${id} no encontrado`);
    }

    res.json(usuario);
};

// POST /api/usuarios
export const create = (req, res) => {
    const { name, nivel } = req.body;

    const nuevoUsuario = {
        id: usuarios.length > 0 ? Math.max(...usuarios.map(u => u.id)) + 1 : 1,
        name,
        nivel
    };

    usuarios.push(nuevoUsuario);

    res.status(201).json(nuevoUsuario);
};

// PUT /api/usuarios/:id
export const update = (req, res) => {
    const id = parseInt(req.params.id);
    const index = usuarios.findIndex(u => u.id === id);

    if (index === -1) {
        throw ApiError.notFound(`Usuario con ID ${id} no encontrado`);
    }

    const { name, nivel } = req.body;

    usuarios[index] = {
        id,
        name,
        nivel
    };

    res.json(usuarios[index]);
};

// PATCH /api/usuarios/:id
export const partialUpdate = (req, res) => {
    const id = parseInt(req.params.id);
    const index = usuarios.findIndex(u => u.id === id);

    if (index === -1) {
        throw ApiError.notFound(`Usuario con ID ${id} no encontrado`);
    }

    usuarios[index] = {
        ...usuarios[index],
        ...req.body
    };

    res.json(usuarios[index]);
};

// DELETE /api/usuarios/:id
export const remove = (req, res) => {
    const id = parseInt(req.params.id);
    const index = usuarios.findIndex(u => u.id === id);

    if (index === -1) {
        throw ApiError.notFound(`Usuario con ID ${id} no encontrado`);
    }

    usuarios.splice(index, 1);

    res.status(204).end();
};
