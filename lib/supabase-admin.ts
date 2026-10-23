import { createClient } from "@supabase/supabase-js"
export function supabaseAdmin(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Configura SUPABASE_URL y SUPABASE_SECRET_KEY en el servidor.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}

