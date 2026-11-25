import {randomBytes} from 'node:crypto';
import {open, mkdir, readFile, rename, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Local, single-process transactional JSON store. It is NOT a distributed database.
const backendDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function storeLocation(){
  const chosen=process.env.DATA_FILE || 'data/veridraw.json';
  return path.isAbsolute(chosen)?chosen:path.resolve(backendDir,chosen);
}
export function emptyStore(){
  return {version:1,admins:[],sessions:[],vrfKeys:[],raffles:[],participants:[],drawResults:[],auditLogs:[]};
}
function validateState(state){
  if(!state || typeof state!=='object' || state.version!==1 ||
    ['admins','sessions','vrfKeys','raffles','participants','drawResults','auditLogs'].some(k=>!Array.isArray(state[k]))) {
    throw new Error('Invalid or incompatible VeriDraw JSON data; restore a known-good backup.');
  }
  return state;
}
async function atomicWrite(file,state){
  const dir=path.dirname(file);
  await mkdir(dir,{recursive:true,mode:0o700});
  const temp=path.join(dir,`.${path.basename(file)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`);
  let handle;
  try {
    handle=await open(temp,'wx',0o600);
    await handle.writeFile(JSON.stringify(state,null,2)+'\n','utf8');
    await handle.sync();
    await handle.close();handle=undefined;
    await rename(temp,file); // atomic replacement on the same filesystem
  } finally {
    if(handle)await handle.close().catch(()=>{});
    await rm(temp,{force:true}).catch(()=>{});
  }
}
/** In-process writes are serialized. A failed mutation never changes the persisted snapshot. */
export function createJsonStore(file){
  let loaded;
  let initialization;
  let tail=Promise.resolve();
  async function init(){
    if(loaded)return;
    if(initialization)return initialization;
    initialization=(async()=>{
      try{
        loaded=validateState(JSON.parse(await readFile(file,'utf8')));
      }catch(err){
        if(err?.code!=='ENOENT')throw err;
        const fresh=emptyStore();
        await atomicWrite(file,fresh);
        loaded=fresh;
      }
    })();
    try{await initialization;}
    catch(err){initialization=undefined;throw err;}
  }
  async function read(){
    await tail;
    await init();
    return structuredClone(loaded);
  }
  function update(mutator){
    const job=tail.then(async()=>{
      await init();
      const draft=structuredClone(loaded);
      const result=await mutator(draft);
      validateState(draft);
      await atomicWrite(file,draft);
      loaded=draft;
      return result;
    });
    tail=job.then(()=>undefined,()=>undefined);
    return job;
  }
  return {init,read,update,file};
}
export const jsonStore=createJsonStore(storeLocation());
