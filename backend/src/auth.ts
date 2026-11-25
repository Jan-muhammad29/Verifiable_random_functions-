import crypto from 'node:crypto';
import type {Request,Response,NextFunction} from 'express';
import {readStore,updateStore,type Session} from './db.js';
import {ApiError} from './errors.js';
const SECURE=process.env.NODE_ENV==='production';
export const makeHash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
export const makePassword=(password:string,salt:string)=>crypto.scryptSync(password,salt,64).toString('hex');
export const randomToken=()=>crypto.randomBytes(32).toString('hex');
const parseCookie=(req:Request)=>{
  const raw=req.headers.cookie??'';
  for(const x of raw.split(';')){const [k,...v]=x.trim().split('=');if(k==='veridraw_session')return v.join('=');}
  return '';
};
export const clearCookie=(res:Response)=>res.clearCookie('veridraw_session',{httpOnly:true,secure:SECURE,sameSite:'lax',path:'/'});
export async function login(email:string,password:string,res:Response){
  const user=(await readStore()).admins.find(x=>x.email===email.toLowerCase());
  // Similar-cost password derivation even when the account does not exist.
  const derived=makePassword(password,user?.password_salt??'0'.repeat(32));
  if(!user||!crypto.timingSafeEqual(Buffer.from(derived,'hex'),Buffer.from(user.password_hash,'hex')))
    throw new ApiError(401,'Invalid credentials');
  const token=randomToken(),csrf=randomToken();
  await updateStore(state=>{
    state.sessions=state.sessions.filter(x=>Date.parse(x.expires_at)>Date.now());
    state.sessions.push({token_hash:makeHash(token),admin_id:user.id,csrf_token:csrf,
      expires_at:new Date(Date.now()+8*60*60*1000).toISOString(),created_at:new Date().toISOString()});
  });
  res.cookie('veridraw_session',token,{httpOnly:true,secure:SECURE,sameSite:'lax',path:'/',maxAge:8*60*60*1000});
  return {email:user.email,csrf};
}
export async function session(req:Request):Promise<(Session&{email:string})|null>{
  const token=parseCookie(req);if(!/^[a-f0-9]{64}$/.test(token))return null;
  const data=await readStore();
  const s=data.sessions.find(x=>x.token_hash===makeHash(token)&&Date.parse(x.expires_at)>Date.now());
  const user=s&&data.admins.find(x=>x.id===s.admin_id);
  return s&&user?{...s,email:user.email}:null;
}
export async function requireAdmin(req:Request,res:Response,next:NextFunction){
  try{
    const user=await session(req);
    if(!user)throw new ApiError(401,'Login required');
    if(req.method!=='GET'&&req.method!=='HEAD'&&req.header('x-csrf-token')!==user.csrf_token)
      throw new ApiError(403,'Invalid CSRF token');
    res.locals.admin=user;
    next();
  }catch(e){next(e);}
}
export async function logout(req:Request,res:Response){
  const token=parseCookie(req);
  if(token)await updateStore(s=>{s.sessions=s.sessions.filter(x=>x.token_hash!==makeHash(token));});
  clearCookie(res);
}
