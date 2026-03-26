import mongoose from 'mongoose';

const podcastSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El título es requerido'],
      trim: true,
      minlength: [3, 'Mínimo 3 caracteres']
    },
    description: {
      type: String,
      required: [true, 'La descripción es requerida'],
      minlength: [10, 'Mínimo 10 caracteres']
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El autor es requerido']
    },
    category: {
      type: String,
      enum: ['tech', 'science', 'history', 'comedy', 'news']
    },
    duration: {
      type: Number,
      min: [60, 'La duración mínima es 60 segundos']
    },
    episodes: {
      type: Number,
      default: 1
    },
    published: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export default mongoose.model('Podcast', podcastSchema);
