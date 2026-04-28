import { EventEmitter } from 'node:events';

const userEvents = new EventEmitter();

const isTest = process.env.NODE_ENV === 'test';

userEvents.on('user:registered', (user) => {
  if (isTest) return;
  const hint = process.env.NODE_ENV !== 'production'
    ? ` | código (dev): ${user.verificationCode}`
    : '';
  console.log(`[EVENT] user:registered → ${user.email}${hint}`);
});

userEvents.on('user:verified', (user) => {
  if (isTest) return;
  console.log(`[EVENT] user:verified → ${user.email}`);
});

userEvents.on('user:invited', (user) => {
  if (isTest) return;
  console.log(`[EVENT] user:invited → ${user.email} | empresa: ${user.company}`);
});

userEvents.on('user:deleted', (user) => {
  if (isTest) return;
  console.log(`[EVENT] user:deleted → ${user.email}`);
});

export default userEvents;
