import { io as ioClient } from 'socket.io-client';
import mongoose from 'mongoose';
import { connectTestDB, startServer, stopServer } from './helpers/setup.js';
import User from '../src/models/user.model.js';
import Room from '../src/models/room.model.js';
import Message from '../src/models/message.model.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/utils/jwt.js';

let server, url, tokenA, tokenB, userA, userB, room;
let socketA, socketB;

const connect = (url, token) =>
  new Promise((resolve, reject) => {
    const s = ioClient(url, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });

const waitFor = (socket, event) =>
  new Promise((resolve) => socket.once(event, resolve));

beforeAll(async () => {
  await connectTestDB();
  ({ server, url } = await startServer());

  const hash = await hashPassword('password123');
  userA = await User.create({ name: 'SocketA', email: `socketa_${Date.now()}@test.com`, password: hash });
  userB = await User.create({ name: 'SocketB', email: `socketb_${Date.now()}@test.com`, password: hash });
  tokenA = signToken(userA._id);
  tokenB = signToken(userB._id);

  room = await Room.create({ name: `socket-room-${Date.now()}`, createdBy: userA._id });

  socketA = await connect(url, tokenA);
  socketB = await connect(url, tokenB);
}, 20000);

afterAll(async () => {
  socketA?.disconnect();
  socketB?.disconnect();
  await Message.deleteMany({ room: room._id });
  await Room.deleteMany({ _id: room._id });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
  await stopServer(server);
});

describe('WebSocket — Autenticación', () => {
  it('rechaza conexión sin token', async () => {
    await new Promise((resolve) => {
      const s = ioClient(url, { auth: {}, transports: ['websocket'] });
      s.on('connect_error', (err) => {
        expect(err.message).toMatch(/token/i);
        s.disconnect();
        resolve();
      });
    });
  });

  it('rechaza token inválido', async () => {
    await new Promise((resolve) => {
      const s = ioClient(url, { auth: { token: 'invalido' }, transports: ['websocket'] });
      s.on('connect_error', (err) => {
        expect(err.message).toMatch(/inválido|invalid/i);
        s.disconnect();
        resolve();
      });
    });
  });
});

describe('WebSocket — Salas', () => {
  it('room:join — emite room:joined con room y users', async () => {
    const [joined] = await Promise.all([
      waitFor(socketA, 'room:joined'),
      new Promise((res) => socketA.emit('room:join', { roomId: room._id.toString() }, res))
    ]);
    expect(joined).toHaveProperty('room');
    expect(joined).toHaveProperty('users');
    expect(Array.isArray(joined.users)).toBe(true);
  });

  it('room:join — el que se une recibe historial en callback', async () => {
    const result = await new Promise((res) =>
      socketB.emit('room:join', { roomId: room._id.toString() }, res)
    );
    expect(result.error).toBe(false);
    expect(Array.isArray(result.history)).toBe(true);
  });

  it('room:user-joined — otros en la sala reciben notificación', async () => {
    const room2 = await Room.create({ name: `join-test-${Date.now()}`, createdBy: userA._id });

    await new Promise((res) => socketA.emit('room:join', { roomId: room2._id.toString() }, res));

    const [notification] = await Promise.all([
      waitFor(socketA, 'room:user-joined'),
      new Promise((res) => socketB.emit('room:join', { roomId: room2._id.toString() }, res))
    ]);

    expect(notification.user).toHaveProperty('name', userB.name);
    await Room.deleteMany({ _id: room2._id });
  });

  it('room:leave — emite room:user-left al resto', async () => {
    const [userLeft] = await Promise.all([
      waitFor(socketA, 'room:user-left'),
      new Promise((res) => socketB.emit('room:leave', { roomId: room._id.toString() }, res))
    ]);
    expect(userLeft.user).toHaveProperty('name', userB.name);
    // Reincorporar socketB para tests siguientes
    await new Promise((res) => socketB.emit('room:join', { roomId: room._id.toString() }, res));
  });
});

describe('WebSocket — Mensajería', () => {
  it('chat:message — persiste en BD y se emite a la sala', async () => {
    const [received] = await Promise.all([
      waitFor(socketB, 'chat:message'),
      new Promise((res) =>
        socketA.emit('chat:message', { roomId: room._id.toString(), content: 'Hola desde test' }, res)
      )
    ]);
    expect(received).toHaveProperty('content', 'Hola desde test');
    expect(received).toHaveProperty('timestamp');
    expect(received.user).toHaveProperty('name', userA.name);

    // Verificar persistencia en BD
    const msg = await Message.findOne({ room: room._id, content: 'Hola desde test' });
    expect(msg).not.toBeNull();
  });

  it('chat:typing — se emite al resto de la sala', async () => {
    const [typing] = await Promise.all([
      waitFor(socketB, 'chat:typing'),
      Promise.resolve(socketA.emit('chat:typing', { roomId: room._id.toString() }))
    ]);
    expect(typing.user).toHaveProperty('name', userA.name);
  });
});

describe('WebSocket — Mensajes privados (bonus)', () => {
  it('chat:private — entrega al destinatario conectado', async () => {
    const [received] = await Promise.all([
      waitFor(socketB, 'chat:private'),
      new Promise((res) =>
        socketA.emit('chat:private', { toUserId: userB._id.toString(), content: 'Mensaje privado test' }, res)
      )
    ]);
    expect(received.content).toBe('Mensaje privado test');
    expect(received.from).toHaveProperty('name', userA.name);
  });

  it('chat:private — informa si el destinatario no está online', async () => {
    // Crear usuario real pero sin socket conectado
    const hash = await hashPassword('password123');
    const offlineUser = await User.create({
      name: 'Offline', email: `offline_${Date.now()}@test.com`, password: hash
    });

    const result = await new Promise((res) =>
      socketA.emit('chat:private', { toUserId: offlineUser._id.toString(), content: 'Test offline' }, res)
    );
    expect(result.error).toBe(false);
    expect(result.delivered).toBe(false);

    await User.deleteOne({ _id: offlineUser._id });
  });
});

describe('WebSocket — Presencia', () => {
  it('user:online — se emite al conectar un nuevo usuario', async () => {
    const onlinePromise = waitFor(socketA, 'user:online');

    const hash = await hashPassword('password123');
    const tempUser = await User.create({ name: 'Temp', email: `temp_${Date.now()}@test.com`, password: hash });
    const tempToken = signToken(tempUser._id);
    const tempSocket = await connect(url, tempToken);

    const online = await onlinePromise;
    expect(online).toHaveProperty('userId');

    tempSocket.disconnect();
    const offline = await waitFor(socketA, 'user:offline');
    expect(offline).toHaveProperty('userId');

    await User.deleteOne({ _id: tempUser._id });
  }, 20000);
});
