import { requireSupabaseClient } from '@/lib/supabase';
import type { DeviceRow } from '@/types/supabase.database';
export class DeviceService {
 async list(storeId:string):Promise<DeviceRow[]>{const client=requireSupabaseClient();const{data,error}=await client.from('devices').select('*').eq('store_id',storeId).order('last_seen_at',{ascending:false});if(error)throw new Error(`Device list failed (${error.code??'unknown'}).`);return data;}
 async revoke(storeId:string,deviceId:string):Promise<void>{const client=requireSupabaseClient();const{error}=await client.rpc('revoke_store_device',{p_store_id:storeId,p_device_id:deviceId});if(error)throw new Error(`Device revocation failed (${error.code??'unknown'}).`);}
}
export const deviceService=new DeviceService();