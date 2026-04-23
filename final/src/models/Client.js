import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    street:   { type: String, trim: true },
    number:   { type: String, trim: true },
    postal:   { type: String, trim: true },
    city:     { type: String, trim: true },
    province: { type: String, trim: true },
  },
  { _id: false }
);

const clientSchema = new mongoose.Schema(
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
    name:    { type: String, required: true, trim: true },
    cif:     { type: String, required: true, trim: true },
    email:   { type: String, trim: true, lowercase: true },
    phone:   { type: String, trim: true },
    address: addressSchema,
    deleted:    { type: Boolean, default: false, index: true },
    deletedAt:  { type: Date,    default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// CIF único por compañía (solo entre no eliminados)
clientSchema.index({ company: 1, cif: 1 }, { unique: true });
clientSchema.index({ company: 1, deleted: 1 });

const Client = mongoose.model('Client', clientSchema);
export default Client;
