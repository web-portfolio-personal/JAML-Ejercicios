import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando datos de prueba...');

  // Users
  const adminPassword = await bcryptjs.hash('Admin1234!', 10);
  const librarianPassword = await bcryptjs.hash('Librarian1234!', 10);
  const userPassword = await bcryptjs.hash('User1234!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@library.com' },
    update: {},
    create: {
      email: 'admin@library.com',
      name: 'Admin',
      password: adminPassword,
      role: 'ADMIN'
    }
  });

  const librarian = await prisma.user.upsert({
    where: { email: 'librarian@library.com' },
    update: {},
    create: {
      email: 'librarian@library.com',
      name: 'Librarian',
      password: librarianPassword,
      role: 'LIBRARIAN'
    }
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@library.com' },
    update: {},
    create: {
      email: 'user@library.com',
      name: 'User',
      password: userPassword,
      role: 'USER'
    }
  });

  // Books
  const book1 = await prisma.book.upsert({
    where: { isbn: '978-0-7432-7356-5' },
    update: {},
    create: {
      isbn: '978-0-7432-7356-5',
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      genre: 'Fiction',
      description: 'A story of the fabulously wealthy Jay Gatsby.',
      publishedYear: 1925,
      copies: 5,
      available: 5
    }
  });

  const book2 = await prisma.book.upsert({
    where: { isbn: '978-0-06-112008-4' },
    update: {},
    create: {
      isbn: '978-0-06-112008-4',
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      genre: 'Fiction',
      description: 'A gripping tale of racial injustice.',
      publishedYear: 1960,
      copies: 3,
      available: 3
    }
  });

  console.log('✅ Seed completado');
  console.log(`👤 Admin: admin@library.com / Admin1234!`);
  console.log(`📚 Librarian: librarian@library.com / Librarian1234!`);
  console.log(`👤 User: user@library.com / User1234!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
