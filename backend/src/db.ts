import 'dotenv/config';
import {jsonStore,storeLocation} from '../store/json-store.mjs';
export type {DataState,Admin,Session,VrfKey,Raffle,Participant,DrawResult,AuditLog} from '../store/json-store.mjs';
export const readStore=()=>jsonStore.read();
export const updateStore=<T>(fn:(state:import('../store/json-store.mjs').DataState)=>T|Promise<T>)=>jsonStore.update(fn);
export const initializeStore=()=>jsonStore.init();
export const storagePath=storeLocation;
export async function audit(actor:string,action:string,raffleId:string|null=null,details:Record<string,unknown>={}){
  await updateStore(state=>{
    state.auditLogs.push({id:(state.auditLogs.at(-1)?.id??0)+1,actor,action,raffle_id:raffleId,details,created_at:new Date().toISOString()});
    if(state.auditLogs.length>10000)state.auditLogs.splice(0,state.auditLogs.length-10000);
  });
}
