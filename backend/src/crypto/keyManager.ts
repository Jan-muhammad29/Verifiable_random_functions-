import {publicKeyFromSeed} from '@collectorcrypt/ecvrf';
import {bytesToHex,computeKeyId,hexToBytesStrict,SUITE} from '@veridraw/protocol';
import {readStore,updateStore} from '../db.js';
import {ApiError} from '../errors.js';
export function currentSeed():Uint8Array{
  const hex=process.env.VRF_PRIVATE_KEY_HEX;
  if(!hex)throw new Error('Set VRF_PRIVATE_KEY_HEX to 32 secure random bytes');
  return hexToBytesStrict(hex,32);
}
export async function currentKey(){
  const publicKeyHex=bytesToHex(publicKeyFromSeed(currentSeed()));
  return {publicKeyHex,keyId:await computeKeyId(publicKeyHex),suite:SUITE};
}
export async function registerActiveKey(){
  const key=await currentKey();
  await updateStore(state=>{
    if(!state.vrfKeys.some(x=>x.key_id===key.keyId))
      state.vrfKeys.push({key_id:key.keyId,public_key_hex:key.publicKeyHex,suite:key.suite,revoked_at:null,created_at:new Date().toISOString()});
  });
  return key;
}
export async function ensureKeyActive(id:string){
  const key=(await readStore()).vrfKeys.find(x=>x.key_id===id);
  if(!key||key.revoked_at)throw new ApiError(409,'Key revoked or missing');
  const current=await currentKey();
  if(id!==current.keyId)throw new ApiError(409,'Raffle key does not match configured private key');
  return current;
}
