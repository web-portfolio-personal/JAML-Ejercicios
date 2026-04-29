import bcrypt from 'bcryptjs';

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, 10);

export const comparePassword = (plain: string, hashed: string): Promise<boolean> =>
  bcrypt.compare(plain, hashed);
