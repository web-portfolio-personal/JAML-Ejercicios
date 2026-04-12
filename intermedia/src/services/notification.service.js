import { EventEmitter } from 'node:events';

const userEvents = new EventEmitter();

userEvents.on('user:registered', (user) => {
  // El código se enviaría por email en producción; en desarrollo se muestra en consola
  const hint = process.env.NODE_ENV !== 'production'
    ? ` | código (dev): ${user.verificationCode}`
    : '';
  console.log(`[EVENT] user:registered → ${user.email}${hint}`);
});

userEvents.on('user:verified', (user) => {
  console.log(`[EVENT] user:verified → ${user.email}`);
});

userEvents.on('user:invited', (user) => {
  console.log(`[EVENT] user:invited → ${user.email} | empresa: ${user.company}`);
});

userEvents.on('user:deleted', (user) => {
  console.log(`[EVENT] user:deleted → ${user.email}`);
});

export default userEvents;
