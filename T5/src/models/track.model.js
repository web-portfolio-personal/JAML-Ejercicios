import mongoose from "mongoose";

const trackSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,           // Obligatorio
        trim: true,               // Eliminar espacios
        minlength: 3,             // Mínimo caracteres
        maxlength: 200            // Máximo caracteres
    },
    duration: {
        type: Number,
        required: true,
        min: [1, 'Mínimo 1 segundo'],
        max: [36000, 'Máximo 10 horas']
    },
    genres: {
        type: [String],
        validate: {
            validator: (v) => v.length > 0,
            message: 'Debe tener al menos un género'
        }
    },
    releaseDate: {
        type: Date,
        default: Date.now
    }
});