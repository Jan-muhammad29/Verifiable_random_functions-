import 'dotenv/config';
import crypto from 'node:crypto';
import {initializeStore,updateStore} from '../src/db.js';
import {makePassword} from '../src/auth.js';
const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password=process.env.ADMIN_PASSWORD;
if(!email||!password||password.length<14)throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 14 characters) in backend/.env');
const salt=crypto.randomBytes(16).toString('hex');
const hash=makePassword(password,salt);
await initializeStore();
await updateStore(state=>{
  const admin=state.admins.find(x=>x.email===email);
  if(admin){admin.password_salt=salt;admin.password_hash=hash;state.sessions=state.sessions.filter(x=>x.admin_id!==admin.id);}
  else state.admins.push({id:crypto.randomUUID(),email,password_salt:salt,password_hash:hash,created_at:new Date().toISOString()});
});
console.log('Organizer created or password changed:',email);
