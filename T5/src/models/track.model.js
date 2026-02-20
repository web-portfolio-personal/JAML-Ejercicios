import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'El título es requerido'],
        trim: true,
        minlength: [3, 'Mínimo 3 caracteres'],
        maxlength: [200, 'Máximo 200 caracteres']
    },
    duration: {
        type: Number,
        required: [true, 'La duración es requerida'],
        min: [1, 'Mínimo 1 segundo'],
        max: [36000, 'Máximo 10 horas']
    },
    // Referencia a User
    artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'El artista es requerido']
    },
    // Array de referencias a User
    collaborators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    genres: {
        type: [String],
        validate: {
            validator: (v) => v.length > 0,
            message: 'Debe tener al menos un género'
        }
    },
    plays: {
        type: Number,
        default: 0,
        min: [0, 'Las reproducciones no pueden ser negativas']
    },
    releaseDate: {
        type: Date,
        default: Date.now
    }
},
{
    timestamps: true,
    versionKey: false
});

// Índices para mejorar rendimiento
trackSchema.index({ artist: 1 });
trackSchema.index({ genres: 1 });
trackSchema.index({ title: 'text' });

const Track = mongoose.model('Track', trackSchema);

export default Track;
