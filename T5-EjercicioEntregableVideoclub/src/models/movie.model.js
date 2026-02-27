// src/models/movie.model.js
import mongoose from 'mongoose';

const GENRES = ['action', 'comedy', 'drama', 'horror', 'scifi'];
const CURRENT_YEAR = new Date().getFullYear();

const movieSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'El título es requerido'],
            trim: true,
            minlength: [2, 'Mínimo 2 caracteres'],
            maxlength: [200, 'Máximo 200 caracteres']
        },
        director: {
            type: String,
            required: [true, 'El director es requerido'],
            trim: true,
            minlength: [2, 'Mínimo 2 caracteres'],
            maxlength: [100, 'Máximo 100 caracteres']
        },
        year: {
            type: Number,
            required: [true, 'El año es requerido'],
            min: [1888, 'El año mínimo es 1888'],
            max: [CURRENT_YEAR, `El año máximo es ${CURRENT_YEAR}`],
            validate: {
                validator: Number.isInteger,
                message: 'El año debe ser un número entero'
            }
        },
        genre: {
            type: String,
            required: [true, 'El género es requerido'],
            enum: {
                values: GENRES,
                message: `{VALUE} no es un género válido. Géneros permitidos: ${GENRES.join(', ')}`
            }
        },
        copies: {
            type: Number,
            default: 5,
            min: [0, 'Las copias no pueden ser negativas'],
            validate: {
                validator: Number.isInteger,
                message: 'Las copias deben ser un número entero'
            }
        },
        availableCopies: {
            type: Number,
            default: undefined, // Se asigna automáticamente en pre-validate
            min: [0, 'Las copias disponibles no pueden ser negativas'],
            validate: {
                validator: Number.isInteger,
                message: 'Las copias disponibles deben ser un número entero'
            }
        },
        timesRented: {
            type: Number,
            default: 0,
            min: [0, 'El contador de alquileres no puede ser negativo']
        },
        cover: {
            type: String,
            default: null
        },
        rating: {
            average: {
                type: Number,
                default: 0,
                min: 0,
                max: 10
            },
            count: {
                type: Number,
                default: 0,
                min: 0
            }
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Pre-validate: si availableCopies no se define, igualarlo a copies
movieSchema.pre('validate', function () {
    if (this.isNew && this.availableCopies === undefined) {
        this.availableCopies = this.copies;
    }
});

// Validación custom: availableCopies nunca debe superar copies
movieSchema.pre('validate', function () {
    if (this.availableCopies > this.copies) {
        this.invalidate('availableCopies', 'Las copias disponibles no pueden superar el total de copias');
    }
});

// Índices para mejorar rendimiento de filtros y búsqueda
movieSchema.index({ genre: 1 });
movieSchema.index({ timesRented: -1 });
movieSchema.index({ title: 'text' });
movieSchema.index({ availableCopies: 1 });

const Movie = mongoose.model('Movie', movieSchema);

export default Movie;

