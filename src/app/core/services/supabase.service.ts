import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private _client: SupabaseClient;

  constructor() {
    const supaUrl = (environment as any).supabase?.url ?? (environment as any).supabaseUrl;
    const supaKey = (environment as any).supabase?.key ?? (environment as any).supabaseKey;
    if (!supaUrl || !supaKey) {
      throw new Error('Missing Supabase configuration. Define environment.supabase.url/key or supabaseUrl/supabaseKey');
    }
    this._client = createClient(supaUrl, supaKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  get client(): SupabaseClient {
    return this._client;
  }
}
