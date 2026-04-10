import request from 'supertest';
import mongoose from 'mongoose';
import { connectTestDB, startServer, stopServer } from './helpers/setup.js';
import User from '../src/models/user.model.js';
import Room from '../src/models/room.model.js';
import Message from '../src/models/message.model.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/utils/jwt.js';

let server, url, token, userId, roomId, messageId;

beforeAll(async () => {
  await connectTestDB();
  ({ server, url } = await startServer());

  const hash = await hashPassword('password123');
  const user = await User.create({ name: 'Rooms User', email: `roomsuser_${Date.now()}@test.com`, password: hash });
  userId = user._id;
  token = signToken(user._id);
});

afterAll(async () => {
  await Message.deleteMany({ room: roomId });
  await Room.deleteMany({ _id: roomId });
  await User.deleteMany({ _id: userId });
  await stopServer(server);
});

describe('GET /api/rooms', () => {
  it('200 — lista salas (público, sin token)', async () => {
    const res = await request(url).get('/api/rooms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/rooms', () => {
  it('401 — sin token', async () => {
    const res = await request(url).post('/api/rooms').send({ name: 'test-sala' });
    expect(res.status).toBe(401);
  });

  it('201 — crea sala correctamente', async () => {
    const res = await request(url)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `sala-test-${Date.now()}`, description: 'Sala de prueba' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('name');
    expect(res.body.data.createdBy).toBeDefined();
    roomId = res.body.data._id;
  });

  it('400 — sin nombre', async () => {
    const res = await request(url)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('409 — nombre duplicado', async () => {
    const room = await Room.findById(roomId);
    const res = await request(url)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: room.name });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/rooms/:id/messages', () => {
  beforeAll(async () => {
    // Insertar mensajes de prueba
    const msgs = await Message.insertMany([
      { room: roomId, user: userId, content: 'Hola mundo' },
      { room: roomId, user: userId, content: 'Segundo mensaje' },
      { room: roomId, user: userId, content: 'Mensaje de búsqueda especial' },
    ]);
    messageId = msgs[0]._id;
  });

  it('200 — devuelve historial con paginación', async () => {
    const res = await request(url)
      .get(`/api/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total');
  });

  it('200 — búsqueda por texto (?search=)', async () => {
    const res = await request(url)
      .get(`/api/rooms/${roomId}/messages?search=especial`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].content).toMatch(/especial/i);
  });

  it('401 — sin token', async () => {
    const res = await request(url).get(`/api/rooms/${roomId}/messages`);
    expect(res.status).toBe(401);
  });

  it('404 — sala no existe', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(url)
      .get(`/api/rooms/${fakeId}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/rooms/:id/messages/:msgId (bonus)', () => {
  it('200 — edita mensaje propio', async () => {
    const res = await request(url)
      .patch(`/api/rooms/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Mensaje editado' });
    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Mensaje editado');
  });

  it('400 — sin content', async () => {
    const res = await request(url)
      .patch(`/api/rooms/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/rooms/:id/messages/:msgId/reactions (bonus)', () => {
  it('200 — añade reacción', async () => {
    const res = await request(url)
      .post(`/api/rooms/${roomId}/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '👍' });
    expect(res.status).toBe(200);
    expect(res.body.data.reactions.length).toBeGreaterThan(0);
  });

  it('200 — toggle quita reacción existente', async () => {
    const res = await request(url)
      .post(`/api/rooms/${roomId}/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '👍' });
    expect(res.status).toBe(200);
    const myReaction = res.body.data.reactions.find(r => r.emoji === '👍' && r.user === userId.toString());
    expect(myReaction).toBeUndefined();
  });
});

describe('DELETE /api/rooms/:id/messages/:msgId (bonus)', () => {
  it('200 — borra mensaje propio', async () => {
    const res = await request(url)
      .delete(`/api/rooms/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('404 — mensaje ya no existe', async () => {
    const res = await request(url)
      .delete(`/api/rooms/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
