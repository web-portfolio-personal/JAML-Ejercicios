/**
 * Seed script — BildyApp MongoDB Atlas
 * Inserta datos de demostración reales en la base de datos de producción.
 *
 * Uso:  node scripts/seed.js
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Cargar .env manualmente (el proyecto no usa dotenv)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* sin .env */ }

// ── Modelos ───────────────────────────────────────────────────────────────────
import Company      from '../src/models/Company.js';
import User         from '../src/models/User.js';
import Client       from '../src/models/Client.js';
import Project      from '../src/models/Project.js';
import DeliveryNote from '../src/models/DeliveryNote.js';

// ── Conexión ──────────────────────────────────────────────────────────────────
console.log('Conectando a MongoDB Atlas…');
await mongoose.connect(process.env.MONGODB_URI);
console.log(`Conectado: ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

// ── Limpiar datos previos del seed (idempotente) ──────────────────────────────
const seedEmails = ['admin@bildyapp.demo', 'dev@bildyapp.demo', 'guest@bildyapp.demo'];
const existingUsers = await User.find({ email: { $in: seedEmails } }).select('+password');
if (existingUsers.length > 0) {
  const userIds     = existingUsers.map(u => u._id);
  const companyIds  = existingUsers.map(u => u.company).filter(Boolean);
  await DeliveryNote.deleteMany({ user: { $in: userIds } });
  await Project.deleteMany({ user: { $in: userIds } });
  await Client.deleteMany({ user: { $in: userIds } });
  if (companyIds.length) await Company.deleteMany({ _id: { $in: companyIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  console.log('Seed anterior eliminado\n');
}

const hash = (pw) => bcrypt.hashSync(pw, 10);

// ── 1. Admin (sin empresa aún — necesario para crear la empresa) ──────────────
const admin = await User.create({
  email:    'admin@bildyapp.demo',
  password: hash('Admin123!'),
  name:     'Carlos',
  lastName: 'Martínez',
  nif:      '12345678A',
  role:     'admin',
  status:   'verified',
});
console.log(`[1/6] Usuario admin creado: ${admin.email}`);

// ── 2. Empresa (requiere owner) ───────────────────────────────────────────────
const company = await Company.create({
  owner:       admin._id,
  name:        'BildyApp Demo SL',
  cif:         'B87654321',
  isFreelance: false,
  address: {
    street:   'Gran Vía',
    number:   '28',
    postal:   '28013',
    city:     'Madrid',
    province: 'Madrid',
  },
});
console.log(`[2/6] Empresa creada: ${company.name} (${company._id})`);

// Actualizar admin con company
await User.updateOne({ _id: admin._id }, { company: company._id });
const adminUpdated = await User.findById(admin._id);
console.log(`      Admin vinculado a empresa`);

// ── 3. Segundo usuario (colaborador) ─────────────────────────────────────────
const dev = await User.create({
  email:    'dev@bildyapp.demo',
  password: hash('Dev123!'),
  name:     'Laura',
  lastName: 'García',
  nif:      '87654321B',
  role:     'guest',
  status:   'verified',
  company:  company._id,
});

const guest = await User.create({
  email:    'guest@bildyapp.demo',
  password: hash('Guest123!'),
  name:     'Pedro',
  lastName: 'Sánchez',
  role:     'guest',
  status:   'verified',
  // Sin empresa — para probar onboarding
});
console.log(`[3/6] Usuarios secundarios: ${dev.email}, ${guest.email} (sin empresa)`);

// ── 4. Clientes ───────────────────────────────────────────────────────────────
const client1 = await Client.create({
  name:    'Constructora Norte SAU',
  cif:     'A11111111',
  email:   'contacto@constructoranorte.es',
  phone:   '+34 912 345 678',
  company: company._id,
  user:    admin._id,
});

const client2 = await Client.create({
  name:    'Reformas del Sur SL',
  cif:     'B22222222',
  email:   'info@reformassur.es',
  phone:   '+34 954 678 901',
  company: company._id,
  user:    admin._id,
});

const client3 = await Client.create({
  name:    'Arquitectura Levante SA',
  cif:     'A33333333',
  email:   'proyectos@arqlevante.es',
  company: company._id,
  user:    dev._id,
});
console.log(`[4/6] Clientes: ${client1.name}, ${client2.name}, ${client3.name}`);

// ── 5. Proyectos ──────────────────────────────────────────────────────────────
const proj1 = await Project.create({
  name:        'Reforma Oficinas Sede Central',
  projectCode: 'PRJ-2025-001',
  client:      client1._id,
  company:     company._id,
  user:        admin._id,
  active:      true,
  notes:       'Reforma integral planta 3 y 4. Entrega Q3 2025.',
});

const proj2 = await Project.create({
  name:        'Instalación Fontanería Residencial',
  projectCode: 'PRJ-2025-002',
  client:      client2._id,
  company:     company._id,
  user:        admin._id,
  active:      true,
});

const proj3 = await Project.create({
  name:        'Proyecto Arquitectónico Torres Norte',
  projectCode: 'PRJ-2025-003',
  client:      client3._id,
  company:     company._id,
  user:        dev._id,
  active:      false,
  notes:       'En espera de aprobación municipal.',
});

const proj4 = await Project.create({
  name:        'Mantenimiento Preventivo Anual',
  projectCode: 'PRJ-2025-004',
  client:      client1._id,
  company:     company._id,
  user:        dev._id,
  active:      true,
});
console.log(`[5/6] Proyectos: ${proj1.projectCode}, ${proj2.projectCode}, ${proj3.projectCode}, ${proj4.projectCode}`);

// ── 6. Albaranes ──────────────────────────────────────────────────────────────
const notes = await DeliveryNote.insertMany([
  {
    client:      client1._id,
    project:     proj1._id,
    company:     company._id,
    user:        admin._id,
    format:      'hours',
    hours:       8,
    workDate:    new Date('2025-04-01'),
    description: 'Desmontaje tabiquería existente — jornada completa',
  },
  {
    client:      client1._id,
    project:     proj1._id,
    company:     company._id,
    user:        dev._id,
    format:      'hours',
    hours:       6,
    workDate:    new Date('2025-04-03'),
    description: 'Replanteo instalación eléctrica',
  },
  {
    client:      client2._id,
    project:     proj2._id,
    company:     company._id,
    user:        admin._id,
    format:      'hours',
    hours:       4,
    workDate:    new Date('2025-04-10'),
    description: 'Inspección estado tuberías',
  },
  {
    client:      client1._id,
    project:     proj4._id,
    company:     company._id,
    user:        dev._id,
    format:      'hours',
    workers:     [
      { name: 'Juan López', hours: 8 },
      { name: 'Ana Torres', hours: 8 },
    ],
    workDate:    new Date('2025-04-15'),
    description: 'Revisión anual — equipo mantenimiento',
  },
  {
    client:      client1._id,
    project:     proj1._id,
    company:     company._id,
    user:        admin._id,
    format:      'material',
    material:    'Hormigón HA-25',
    quantity:    12.5,
    unit:        'm³',
    workDate:    new Date('2025-04-05'),
    description: 'Solera planta 3',
  },
  {
    client:      client2._id,
    project:     proj2._id,
    company:     company._id,
    user:        admin._id,
    format:      'material',
    material:    'Tubo PVC 110mm',
    quantity:    200,
    unit:        'm',
    workDate:    new Date('2025-04-12'),
    description: 'Red saneamiento horizontal',
  },
  {
    client:      client3._id,
    project:     proj3._id,
    company:     company._id,
    user:        dev._id,
    format:      'material',
    material:    'Perfil Metálico HEB-200',
    quantity:    85,
    unit:        'kg',
    workDate:    new Date('2025-03-20'),
    description: 'Estructura principal',
    signed:      true,
    signedAt:    new Date('2025-03-21'),
  },
]);
console.log(`[6/6] Albaranes: ${notes.length} (${notes.filter(n => n.format === 'hours').length} horas, ${notes.filter(n => n.format === 'material').length} material)`);

// ── Resumen ───────────────────────────────────────────────────────────────────
console.log('\n✅ Seed MongoDB completado:');
console.log('   Empresa   : BildyApp Demo SL (cif: B87654321)');
console.log('   Acceso admin:');
console.log('     email: admin@bildyapp.demo');
console.log('     pass:  Admin123!');
console.log('   Acceso colaborador:');
console.log('     email: dev@bildyapp.demo');
console.log('     pass:  Dev123!');
console.log('   Sin empresa (onboarding):');
console.log('     email: guest@bildyapp.demo');
console.log('     pass:  Guest123!');

await mongoose.disconnect();
