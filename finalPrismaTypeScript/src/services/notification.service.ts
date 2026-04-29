import { EventEmitter } from 'node:events';

const userEvents = new EventEmitter();

const isTest = process.env.NODE_ENV === 'test';

userEvents.on('user:registered', (user: { email: string; verificationCode?: string }) => {
  if (isTest) return;
  const hint =
    process.env.NODE_ENV !== 'production'
      ? ` | codigo (dev): ${user.verificationCode}`
      : '';
  console.log(`[EVENT] user:registered → ${user.email}${hint}`);
});

userEvents.on('user:verified', (user: { email: string }) => {
  if (isTest) return;
  console.log(`[EVENT] user:verified → ${user.email}`);
});

userEvents.on('user:invited', (user: { email: string; companyId?: string | null }) => {
  if (isTest) return;
  console.log(`[EVENT] user:invited → ${user.email} | empresa: ${user.companyId}`);
});

userEvents.on('user:deleted', (user: { email: string }) => {
  if (isTest) return;
  console.log(`[EVENT] user:deleted → ${user.email}`);
});

export default userEvents;
