import mongoose from 'mongoose';

const dbConnect = async (uri) => {
  const DB_URI = uri || process.env.MONGODB_URI;
  try {
    await mongoose.connect(DB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

export default dbConnect;
