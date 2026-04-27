import mongoose from 'mongoose';

const workerSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    hours: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const deliveryNoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    format: {
      type: String,
      enum: ['material', 'hours'],
      required: true,
    },
    description: { type: String, trim: true },
    workDate:    { type: Date, required: true },

    // Campos para format: 'material'
    material: { type: String, trim: true },
    quantity: { type: Number, min: 0 },
    unit:     { type: String, trim: true },

    // Campos para format: 'hours'
    hours:   { type: Number, min: 0 },
    workers: [workerSchema],

    // Firma
    signed:       { type: Boolean, default: false },
    signedAt:     { type: Date,    default: null },
    signatureUrl: { type: String,  default: null },
    pdfUrl:       { type: String,  default: null },

    deleted:   { type: Boolean, default: false, index: true },
    deletedAt: { type: Date,    default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

deliveryNoteSchema.index({ company: 1, deleted: 1 });
deliveryNoteSchema.index({ project: 1 });
deliveryNoteSchema.index({ client: 1 });
deliveryNoteSchema.index({ workDate: -1 });

const DeliveryNote = mongoose.model('DeliveryNote', deliveryNoteSchema);
export default DeliveryNote;
