import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createJsonStore} from './json-store.mjs';

async function testStore(fn){
 const temp=await mkdtemp(path.join(os.tmpdir(),'veridraw-json-test-'));
 try{await fn(createJsonStore(path.join(temp,'state.json')),path.join(temp,'state.json'));}
 finally{await rm(temp,{recursive:true,force:true});}
}
test('initializes an empty valid local JSON file',async()=>testStore(async(store,file)=>{
 await store.init();
 const data=JSON.parse(await readFile(file,'utf8'));
 assert.equal(data.version,1);
 assert.deepEqual(data.raffles,[]);
 assert.deepEqual(data.sessions,[]);
}));
test('writes survive creating a fresh store instance',async()=>testStore(async(store,file)=>{
 await store.update(s=>{s.auditLogs.push({id:1,actor:'test',action:'created',raffle_id:null,details:{},created_at:'2026-01-01T00:00:00.000Z'});});
 const recovered=createJsonStore(file);
 assert.equal((await recovered.read()).auditLogs.length,1);
}));
test('concurrent mutations are serialized without losing updates',async()=>testStore(async store=>{
 const jobs=Array.from({length:50},(_,n)=>store.update(async s=>{
   const id=s.auditLogs.length+1;
   await Promise.resolve();
   s.auditLogs.push({id,actor:'test',action:String(n),raffle_id:null,details:{},created_at:'2026-01-01T00:00:00.000Z'});
 }));
 await Promise.all(jobs);
 const state=await store.read();
 assert.equal(state.auditLogs.length,50);
 assert.deepEqual(state.auditLogs.map(x=>x.id),Array.from({length:50},(_,i)=>i+1));
}));
test('failed mutation rolls back cleanly',async()=>testStore(async(store,file)=>{
 await assert.rejects(store.update(s=>{s.admins.push({id:'broken'});throw new Error('abort');}),/abort/);
 assert.deepEqual((await store.read()).admins,[]);
 assert.deepEqual(JSON.parse(await readFile(file,'utf8')).admins,[]);
}));
test('rejects corrupted data instead of silently resetting',async()=>testStore(async(store,file)=>{
 await store.init();
 const {writeFile}=await import('node:fs/promises');
 await writeFile(file,'corrupted JSON');
 await assert.rejects(createJsonStore(file).read());
}));
