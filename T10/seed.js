/**
 * seed.js — Datos de prueba para T10 Chat en Tiempo Real
 * Uso: npm run seed
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Models
const userSchema = new mongoose.Schema(
  { name: String, email: String, password: String },
  { timestamps: true }
);
const roomSchema = new mongoose.Schema(
  { name: String, description: String, createdBy: mongoose.Schema.Types.ObjectId },
  { timestamps: true }
);
const messageSchema = new mongoose.Schema(
  {
    room: mongoose.Schema.Types.ObjectId,
    user: mongoose.Schema.Types.ObjectId,
    content: String,
    reactions: { type: Array, default: [] }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);
const Message = mongoose.model('Message', messageSchema);

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('🔗 Conectado a MongoDB');

  // Limpiar colecciones
  await Promise.all([User.deleteMany(), Room.deleteMany(), Message.deleteMany()]);
  console.log('🧹 Colecciones limpiadas');

  // Usuarios de prueba
  const hash = await bcrypt.hash('password123', 10);
  const [alice, bob, charlie] = await User.insertMany([
    { name: 'Alice',   email: 'alice@test.com',   password: hash },
    { name: 'Bob',     email: 'bob@test.com',     password: hash },
    { name: 'Charlie', email: 'charlie@test.com', password: hash },
  ]);
  console.log('👥 Usuarios creados: alice@test.com, bob@test.com, charlie@test.com (pass: password123)');

  // Salas de prueba
  const [general, tech, random] = await Room.insertMany([
    { name: 'general', description: 'Canal general para todos', createdBy: alice._id },
    { name: 'tech',    description: 'Desarrollo y programación',  createdBy: bob._id },
    { name: 'random',  description: 'Off-topic y humor',          createdBy: charlie._id },
  ]);
  console.log('🏠 Salas creadas: general, tech, random');

  // Mensajes de prueba
  const now = new Date();
  await Message.insertMany([
    // #general
    { room: general._id, user: alice._id,   content: '¡Hola a todos! 👋',                    createdAt: new Date(now - 60000 * 10) },
    { room: general._id, user: bob._id,     content: 'Hola Alice, ¿qué tal?',                createdAt: new Date(now - 60000 * 9) },
    { room: general._id, user: charlie._id, content: '¡Buenos días! Empezando el día 🚀',    createdAt: new Date(now - 60000 * 8) },
    { room: general._id, user: alice._id,   content: 'Todo genial, gracias por preguntar 😊', createdAt: new Date(now - 60000 * 5) },
    // #tech
    { room: tech._id, user: bob._id,     content: '¿Alguien ha probado Socket.IO v4?',       createdAt: new Date(now - 60000 * 7) },
    { room: tech._id, user: alice._id,   content: 'Sí, la API de rooms ha mejorado mucho',   createdAt: new Date(now - 60000 * 6) },
    { room: tech._id, user: charlie._id, content: 'El middleware de auth es muy limpio ahora', createdAt: new Date(now - 60000 * 4) },
    // #random
    { room: random._id, user: charlie._id, content: '¿Qué música estáis escuchando hoy? 🎵', createdAt: new Date(now - 60000 * 3) },
    { room: random._id, user: alice._id,   content: 'Lo fi hip-hop para estudiar 🎧',         createdAt: new Date(now - 60000 * 2) },
    { room: random._id, user: bob._id,     content: 'Metal a todo volumen 🤘',                createdAt: new Date(now - 60000 * 1) },
  ]);
  console.log('💬 Mensajes de prueba insertados');

  console.log('\n✅ Seed completado. Datos disponibles:');
  console.log('   Users:    alice@test.com | bob@test.com | charlie@test.com');
  console.log('   Password: password123');
  console.log('   Rooms:    general | tech | random');
  console.log('\n🚀 Arranca el servidor: npm run dev');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err.message);
  process.exit(1);
});
