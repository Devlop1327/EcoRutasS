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
    // Use a small custom storage wrapper around localStorage to avoid
    // the Web Lock API acquisition issues that some environments report.
    // Supabase will call the storage methods as async; we return Promises
    // to match that expectation.
    const localStorageWrapper = {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
      removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
    } as any;

    this._client = createClient(supaUrl, supaKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorageWrapper,
      },
    });
  }

  get client(): SupabaseClient {
    return this._client;
  }
}
