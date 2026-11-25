import crypto from 'node:crypto';
import {proveVRF,vrfProofToHash} from '@collectorcrypt/ecvrf';
import {bytesToHex,canonicalRoster,computeRosterHashHex,computeCommitmentHashHex,
 encodeAlphaHex,hexToBytesStrict,selectWinnerIndex,PROTOCOL_VERSION,SUITE,
 drandRoundForTime,drandRoundAt,fetchVerifiedDrandRound,type DrawCertificate} from '@veridraw/protocol';
import {readStore,updateStore,audit,type DataState,type Raffle} from './db.js';
import {ApiError} from './errors.js';
import {currentKey,currentSeed,ensureKeyActive} from './crypto/keyManager.js';
const now=()=>new Date().toISOString();
function requiredRaffle(state:DataState,id:string){
 const found=state.raffles.find(x=>x.id===id);
 if(!found)throw new ApiError(404,'Raffle not found');
 return found;
}
function summary(state:DataState,r:Raffle){
 return {id:r.id,title:r.title,description:r.description,status:r.status,keyId:r.key_id,beaconRound:String(r.beacon_round),
  roundAt:r.round_at,lockDeadline:r.lock_deadline,lockedAt:r.locked_at,rosterHashHex:r.roster_hash,
  commitmentHashHex:r.commitment_hash,participantCount:state.participants.filter(p=>p.raffle_id===r.id).length,createdAt:r.created_at};
}
function commitmentOf(r:Raffle){
 return {raffleId:r.id,keyId:r.key_id,rosterHashHex:r.roster_hash!,beaconRound:String(r.beacon_round),
 lockedAt:r.locked_at!,lockDeadline:r.lock_deadline};
}
export async function listRaffles(){
 const state=await readStore();
 return state.raffles.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100).map(x=>summary(state,x));
}
export async function getRaffle(id:string){const state=await readStore();return summary(state,requiredRaffle(state,id));}
export async function createRaffle(title:string,description:string,scheduledMs:number){
 if(!Number.isFinite(scheduledMs)||scheduledMs<Date.now()+120_000||scheduledMs>Date.now()+365*24*3600_000)
   throw new ApiError(400,'Choose draw time between 2 minutes and 365 days in future');
 const key=await currentKey();await ensureKeyActive(key.keyId);
 const round=drandRoundForTime(scheduledMs),at=drandRoundAt(round),id=crypto.randomUUID();
 await updateStore(state=>{
   if(!state.vrfKeys.find(x=>x.key_id===key.keyId&&!x.revoked_at))throw new ApiError(409,'Configured key is revoked');
   state.raffles.push({id,title,description,key_id:key.keyId,status:'OPEN',beacon_round:round,
     round_at:new Date(at).toISOString(),lock_deadline:new Date(at-30_000).toISOString(),
     locked_at:null,roster_json:null,roster_hash:null,commitment_hash:null,claim_at:null,created_at:now()});
 });
 await audit('organizer','raffle.created',id,{round,keyId:key.keyId});
 return getRaffle(id);
}
export async function listParticipants(id:string){
 const state=await readStore();requiredRaffle(state,id);
 const entries=state.participants.filter(p=>p.raffle_id===id).map(p=>({id:p.participant_code,name:p.display_name}));
 return entries.length?canonicalRoster(entries):[];
}
export async function registerParticipant(id:string,name:string,code:string){
 if(name!==name.normalize('NFC'))throw new ApiError(400,'Name must be Unicode NFC');
 return updateStore(state=>{
   const raffle=requiredRaffle(state,id);
   if(raffle.status!=='OPEN'||Date.now()>=Date.parse(raffle.lock_deadline))throw new ApiError(409,'Raffle registration closed');
   if(state.participants.some(x=>x.raffle_id===id&&x.participant_code===code))throw new ApiError(409,'Participant code already registered');
   state.participants.push({id:crypto.randomUUID(),raffle_id:id,participant_code:code,display_name:name,joined_at:now()});
   return {id:code,name};
 });
}
export async function lockRaffle(id:string){
 const result=await updateStore(async state=>{
   const raffle=requiredRaffle(state,id);
   if(raffle.status!=='OPEN')throw new ApiError(409,'Raffle is not OPEN');
   const lockedAt=now();
   if(Date.parse(lockedAt)>Date.parse(raffle.lock_deadline))throw new ApiError(409,'Too late to lock before beacon reveal');
   const entries=state.participants.filter(p=>p.raffle_id===id).map(p=>({id:p.participant_code,name:p.display_name}));
   if(!entries.length)throw new ApiError(409,'Add at least one participant before locking');
   const roster=canonicalRoster(entries),rosterHashHex=await computeRosterHashHex(roster);
   const commitment={raffleId:id,keyId:raffle.key_id,rosterHashHex,beaconRound:String(raffle.beacon_round),
     lockedAt,lockDeadline:raffle.lock_deadline};
   const hash=await computeCommitmentHashHex(commitment);
   raffle.status='LOCKED';raffle.locked_at=lockedAt;raffle.roster_json=roster;
   raffle.roster_hash=rosterHashHex;raffle.commitment_hash=hash;
   return {commitment,commitmentHashHex:hash,participants:roster,publicKeyId:raffle.key_id,
     note:'Publish this commitment hash to an independent timestamped channel BEFORE the drand round!'};
 });
 await audit('organizer','raffle.locked',id,{commitmentHash:result.commitmentHashHex});
 return result;
}
export async function getCommitment(id:string){
 const state=await readStore();const raffle=requiredRaffle(state,id);
 if(!raffle.locked_at||!raffle.roster_json)throw new ApiError(409,'Raffle not yet locked');
 const key=state.vrfKeys.find(x=>x.key_id===raffle.key_id);
 if(!key)throw new ApiError(409,'Public key missing');
 return {commitment:commitmentOf(raffle),commitmentHashHex:raffle.commitment_hash,
   publicKeyHex:key.public_key_hex,participants:raffle.roster_json,beaconRoundAt:raffle.round_at,
   warning:'Server-hosted timestamps alone do not prove precommitment to a dishonest organizer.'};
}
export async function drawRaffle(id:string):Promise<DrawCertificate>{
 // Atomically claim one draw before contacting the network. A failed attempt can be retried.
 const claimed=await updateStore(state=>{
   const raffle=requiredRaffle(state,id);
   if(raffle.status==='DRAWING'&&raffle.claim_at&&Date.now()-Date.parse(raffle.claim_at)>10*60_000
      &&!state.drawResults.some(x=>x.raffle_id===id)){raffle.status='LOCKED';raffle.claim_at=null;}
   if(raffle.status!=='LOCKED'||Date.now()<Date.parse(raffle.round_at))
     throw new ApiError(409,'Draw unavailable: must be LOCKED and scheduled beacon round must have arrived');
   if(state.drawResults.some(x=>x.raffle_id===id))throw new ApiError(409,'Draw already recorded');
   raffle.status='DRAWING';raffle.claim_at=now();
   return structuredClone(raffle);
 });
 try{
   const key=await ensureKeyActive(claimed.key_id);
   const beacon=await fetchVerifiedDrandRound(claimed.beacon_round);
   if(!claimed.roster_json||!claimed.roster_hash||!claimed.commitment_hash)throw new ApiError(409,'Incomplete raffle commitment');
   const roster=canonicalRoster(claimed.roster_json);
   const alphaHex=encodeAlphaHex({raffleId:id,keyId:claimed.key_id,rosterHashHex:claimed.roster_hash,beacon});
   const proof=proveVRF(currentSeed(),hexToBytesStrict(alphaHex)).proof;
   const proofHex=bytesToHex(proof),betaHex=bytesToHex(vrfProofToHash(proof));
   const winnerIndex=await selectWinnerIndex(betaHex,roster.length);
   const cert:DrawCertificate={version:PROTOCOL_VERSION,suite:SUITE,mode:'COMMITTED_BEACON',raffleId:id,
     keyId:claimed.key_id,publicKeyHex:key.publicKeyHex,participants:roster,rosterHashHex:claimed.roster_hash,
     commitment:commitmentOf(claimed),commitmentHashHex:claimed.commitment_hash,beacon,
     alphaHex,proofHex,betaHex,winnerIndex,winnerId:roster[winnerIndex].id,generatedAt:now()};
   await updateStore(state=>{
     const raffle=requiredRaffle(state,id);
     if(raffle.status!=='DRAWING'||state.drawResults.some(x=>x.raffle_id===id))throw new ApiError(409,'Draw claim lost');
     state.drawResults.push({raffle_id:id,certificate:cert,winner_id:cert.winnerId,created_at:now()});
     raffle.status='DRAWN';raffle.claim_at=null;
   });
   await audit('organizer','raffle.drawn',id,{winnerId:cert.winnerId}).catch(e=>console.warn('Audit append failed:',e));
   return cert;
 }catch(err){
   await updateStore(state=>{
     const raffle=state.raffles.find(x=>x.id===id);
     if(raffle?.status==='DRAWING'&&!state.drawResults.some(x=>x.raffle_id===id)){
       raffle.status='LOCKED';raffle.claim_at=null;
     }
   }).catch(()=>{});
   throw err;
 }
}
export async function getResult(id:string):Promise<DrawCertificate>{
 const state=await readStore();
 const cert=state.drawResults.find(x=>x.raffle_id===id)?.certificate;
 if(!cert)throw new ApiError(404,'Draw result not available');
 return cert as DrawCertificate;
}
