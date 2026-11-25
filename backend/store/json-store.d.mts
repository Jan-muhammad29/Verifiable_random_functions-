export interface Admin {id:string;email:string;password_salt:string;password_hash:string;created_at:string}
export interface Session {token_hash:string;admin_id:string;csrf_token:string;expires_at:string;created_at:string}
export interface VrfKey {key_id:string;public_key_hex:string;suite:string;revoked_at:string|null;created_at:string}
export interface Raffle {id:string;title:string;description:string;status:'OPEN'|'LOCKED'|'DRAWING'|'DRAWN';key_id:string;beacon_round:number;round_at:string;lock_deadline:string;locked_at:string|null;roster_json:{id:string;name:string}[]|null;roster_hash:string|null;commitment_hash:string|null;claim_at:string|null;created_at:string}
export interface Participant {id:string;raffle_id:string;participant_code:string;display_name:string;joined_at:string}
export interface DrawResult {raffle_id:string;certificate:unknown;winner_id:string;created_at:string}
export interface AuditLog {id:number;actor:string;action:string;raffle_id:string|null;details:Record<string,unknown>;created_at:string}
export interface DataState {version:1;admins:Admin[];sessions:Session[];vrfKeys:VrfKey[];raffles:Raffle[];participants:Participant[];drawResults:DrawResult[];auditLogs:AuditLog[]}
export function storeLocation():string;
export function emptyStore():DataState;
export function createJsonStore(file:string): {init():Promise<void>;read():Promise<DataState>;update<T>(fn:(s:DataState)=>Promise<T>|T):Promise<T>;file:string};
export const jsonStore:ReturnType<typeof createJsonStore>;
