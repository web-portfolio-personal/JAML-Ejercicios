import { EventEmitter } from 'node:events';

const userEvents = new EventEmitter();

const isTest = process.env.NODE_ENV === 'test';

userEvents.on('user:registered', (user) => {
  /* istanbul ignore else */
  if (isTest) return;
  /* c8 ignore start */
  const hint = process.env.NODE_ENV !== 'production'
    ? ` | código (dev): ${user.verificationCode}`
    : '';
  console.log(`[EVENT] user:registered → ${user.email}${hint}`);
  /* c8 ignore stop */
});

userEvents.on('user:verified', (user) => {
  /* istanbul ignore else */
  if (isTest) return;
  /* c8 ignore next */
  console.log(`[EVENT] user:verified → ${user.email}`);
});

userEvents.on('user:invited', (user) => {
  /* istanbul ignore else */
  if (isTest) return;
  /* c8 ignore next */
  console.log(`[EVENT] user:invited → ${user.email} | empresa: ${user.company}`);
});

userEvents.on('user:deleted', (user) => {
  /* istanbul ignore else */
  if (isTest) return;
  /* c8 ignore next */
  console.log(`[EVENT] user:deleted → ${user.email}`);
});

export default userEvents;
