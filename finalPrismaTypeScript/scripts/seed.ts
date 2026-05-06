/**
 * Seed script — BildyApp Supabase/PostgreSQL (Prisma)
 * Inserta datos de demostración reales en la base de datos.
 *
 * Uso:  npx tsx scripts/seed.ts
 */

import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/utils/password';

async function main() {
  console.log('Conectando a la base de datos…');
  await prisma.$connect();
  console.log('Conectado\n');

  // ── Limpiar seed anterior (idempotente) ──────────────────────────────────────
  const seedEmails = ['admin@bildyapp.demo', 'dev@bildyapp.demo', 'guest@bildyapp.demo'];
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: seedEmails } },
  });

  if (existingUsers.length > 0) {
    const userIds    = existingUsers.map(u => u.id);
    const companyIds = existingUsers.map(u => u.companyId).filter((id): id is string => id !== null);

    await prisma.deliveryNote.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.project.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.client.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (companyIds.length) {
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    }
    console.log('Seed anterior eliminado\n');
  }

  // ── 1. Empresa ───────────────────────────────────────────────────────────────
  const company = await prisma.company.create({
    data: {
      name:        'BildyApp Demo SL',
      cif:         'B87654321',
      isFreelance: false,
      address:     JSON.stringify({
        street: 'Gran Vía', number: '28', postal: '28013',
        city: 'Madrid', province: 'Madrid',
      }),
    },
  });
  console.log(`[1/6] Empresa: ${company.name} (${company.id})`);

  // ── 2. Usuarios ──────────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email:     'admin@bildyapp.demo',
      password:  await hashPassword('Admin123!'),
      name:      'Carlos',
      lastName:  'Martínez',
      nif:       '12345678A',
      role:      'admin',
      status:    'verified',
      companyId: company.id,
    },
  });

  const dev = await prisma.user.create({
    data: {
      email:     'dev@bildyapp.demo',
      password:  await hashPassword('Dev123!'),
      name:      'Laura',
      lastName:  'García',
      nif:       '87654321B',
      role:      'user',
      status:    'verified',
      companyId: company.id,
    },
  });

  const guestUser = await prisma.user.create({
    data: {
      email:    'guest@bildyapp.demo',
      password: await hashPassword('Guest123!'),
      name:     'Pedro',
      lastName: 'Sánchez',
      role:     'user',
      status:   'verified',
      // Sin empresa — para probar onboarding
    },
  });
  console.log(`[2/6] Usuarios: ${admin.email}, ${dev.email}, ${guestUser.email} (sin empresa)`);

  // ── 3. Clientes ──────────────────────────────────────────────────────────────
  const client1 = await prisma.client.create({
    data: {
      name:      'Constructora Norte SAU',
      cif:       'A11111111',
      email:     'contacto@constructoranorte.es',
      phone:     '+34 912 345 678',
      companyId: company.id,
      userId:    admin.id,
    },
  });

  const client2 = await prisma.client.create({
    data: {
      name:      'Reformas del Sur SL',
      cif:       'B22222222',
      email:     'info@reformassur.es',
      phone:     '+34 954 678 901',
      companyId: company.id,
      userId:    admin.id,
    },
  });

  const client3 = await prisma.client.create({
    data: {
      name:      'Arquitectura Levante SA',
      cif:       'A33333333',
      email:     'proyectos@arqlevante.es',
      companyId: company.id,
      userId:    dev.id,
    },
  });
  console.log(`[3/6] Clientes: ${client1.name}, ${client2.name}, ${client3.name}`);

  // ── 4. Proyectos ─────────────────────────────────────────────────────────────
  const proj1 = await prisma.project.create({
    data: {
      name:        'Reforma Oficinas Sede Central',
      projectCode: 'PRJ-2025-001',
      clientId:    client1.id,
      companyId:   company.id,
      userId:      admin.id,
      active:      true,
      notes:       'Reforma integral planta 3 y 4. Entrega Q3 2025.',
    },
  });

  const proj2 = await prisma.project.create({
    data: {
      name:        'Instalación Fontanería Residencial',
      projectCode: 'PRJ-2025-002',
      clientId:    client2.id,
      companyId:   company.id,
      userId:      admin.id,
      active:      true,
    },
  });

  const proj3 = await prisma.project.create({
    data: {
      name:        'Proyecto Arquitectónico Torres Norte',
      projectCode: 'PRJ-2025-003',
      clientId:    client3.id,
      companyId:   company.id,
      userId:      dev.id,
      active:      false,
      notes:       'En espera de aprobación municipal.',
    },
  });

  const proj4 = await prisma.project.create({
    data: {
      name:        'Mantenimiento Preventivo Anual',
      projectCode: 'PRJ-2025-004',
      clientId:    client1.id,
      companyId:   company.id,
      userId:      dev.id,
      active:      true,
    },
  });
  console.log(`[4/6] Proyectos: ${proj1.projectCode}, ${proj2.projectCode}, ${proj3.projectCode}, ${proj4.projectCode}`);

  // ── 5. Albaranes ─────────────────────────────────────────────────────────────
  const noteData = [
    {
      clientId: client1.id, projectId: proj1.id, companyId: company.id, userId: admin.id,
      format: 'hours', hours: 8, workDate: new Date('2025-04-01'),
      description: 'Desmontaje tabiquería existente — jornada completa',
    },
    {
      clientId: client1.id, projectId: proj1.id, companyId: company.id, userId: dev.id,
      format: 'hours', hours: 6, workDate: new Date('2025-04-03'),
      description: 'Replanteo instalación eléctrica',
    },
    {
      clientId: client2.id, projectId: proj2.id, companyId: company.id, userId: admin.id,
      format: 'hours', hours: 4, workDate: new Date('2025-04-10'),
      description: 'Inspección estado tuberías',
    },
    {
      clientId: client1.id, projectId: proj4.id, companyId: company.id, userId: dev.id,
      format: 'hours',
      workers: JSON.stringify([{ name: 'Juan López', hours: 8 }, { name: 'Ana Torres', hours: 8 }]),
      workDate: new Date('2025-04-15'),
      description: 'Revisión anual — equipo mantenimiento',
    },
    {
      clientId: client1.id, projectId: proj1.id, companyId: company.id, userId: admin.id,
      format: 'material', material: 'Hormigón HA-25', quantity: 12.5, unit: 'm³',
      workDate: new Date('2025-04-05'), description: 'Solera planta 3',
    },
    {
      clientId: client2.id, projectId: proj2.id, companyId: company.id, userId: admin.id,
      format: 'material', material: 'Tubo PVC 110mm', quantity: 200, unit: 'm',
      workDate: new Date('2025-04-12'), description: 'Red saneamiento horizontal',
    },
    {
      clientId: client3.id, projectId: proj3.id, companyId: company.id, userId: dev.id,
      format: 'material', material: 'Perfil Metálico HEB-200', quantity: 85, unit: 'kg',
      workDate: new Date('2025-03-20'), description: 'Estructura principal',
      signed: true, signedAt: new Date('2025-03-21'),
    },
  ];

  let noteCount = 0;
  for (const data of noteData) {
    await prisma.deliveryNote.create({ data });
    noteCount++;
  }
  console.log(`[5/6] Albaranes: ${noteCount}`);

  // ── Resumen ───────────────────────────────────────────────────────────────────
  const total = {
    users:    await prisma.user.count({ where: { companyId: company.id } }),
    clients:  await prisma.client.count({ where: { companyId: company.id } }),
    projects: await prisma.project.count({ where: { companyId: company.id } }),
    notes:    await prisma.deliveryNote.count({ where: { companyId: company.id } }),
  };

  console.log('\n✅ Seed completado en Supabase/PostgreSQL:');
  console.log(`   Empresa   : ${company.name} (cif: ${company.cif})`);
  console.log(`   Usuarios  : ${total.users} en empresa`);
  console.log(`   Clientes  : ${total.clients}`);
  console.log(`   Proyectos : ${total.projects}`);
  console.log(`   Albaranes : ${total.notes}`);
  console.log('\n   Credenciales de acceso:');
  console.log('     admin@bildyapp.demo  /  Admin123!  (rol: admin)');
  console.log('     dev@bildyapp.demo    /  Dev123!    (rol: user)');
  console.log('     guest@bildyapp.demo  /  Guest123!  (sin empresa)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
