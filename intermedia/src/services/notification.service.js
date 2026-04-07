import { EventEmitter } from 'node:events';

const userEvents = new EventEmitter();

userEvents.on('user:registered', (user) => {
  console.log(`[EVENT] user:registered → ${user.email} | código: ${user.verificationCode}`);
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
