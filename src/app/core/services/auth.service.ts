import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseClient, User, type AuthError } from '@supabase/supabase-js';
import { signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SupabaseService } from './supabase.service';

type SignInCredentials = {
  email: string;
  password: string;
};

type SignUpCredentials = SignInCredentials & {
  username: string;
  role?: string;
};

type AuthResponse = {
  user: User | null;
  error?: Error;
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;
  private router = inject(Router);
  private document = inject(DOCUMENT);
  
  // Estado de autenticación
  currentUser = signal<User | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  role = signal<'cliente' | 'conductor' | 'admin' | null>(null);

  constructor() {
    const supa = inject(SupabaseService);
    this.supabase = supa.client;

    // Verificar sesión al cargar
    this.checkAuth();

    // Escuchar cambios de autenticación
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser.set(session?.user ?? null);
      this.isLoading.set(false);
    });
  }

  private async checkAuth() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        throw error;
      }
      
      this.currentUser.set(session?.user ?? null);
      if (session?.user?.id) {
        await this.loadProfileRole(session.user.id);
      } else {
        this.role.set(null);
      }
      return session?.user ?? null;
    } catch (error) {
      console.error('Error checking auth:', error);
      this.error.set('Error al verificar la sesión');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw new Error(this.getFriendlyAuthError(error));
      }
      
      this.currentUser.set(data.user);
      if (data.user?.id) {
        await this.loadProfileRole(data.user.id);
      }
      this.router.navigate(['/dashboard']);
      return { user: data.user };
    } catch (error: any) {
      console.error('Error signing in:', error);
      this.error.set(error.message);
      return { user: null, error };
    } finally {
      this.isLoading.set(false);
    }
  }

  async signInWithGoogle(): Promise<{ error?: Error }> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      const baseHref = this.document?.baseURI || window.location.origin + '/';
      const basePath = new URL(baseHref).pathname.replace(/\/$/, '');
      const redirectTo = `${window.location.origin}${basePath}/auth/callback`;

      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      
      // No devolvemos el usuario aquí ya que la redirección de OAuth
      // manejará el flujo de autenticación
      return {};
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      this.error.set(error.message || 'Error al iniciar con Google');
      return { error };
    } finally {
      this.isLoading.set(false);
    }
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      const baseHref = this.document?.baseURI || window.location.origin + '/';
      const basePath = new URL(baseHref).pathname.replace(/\/$/, '');
      const emailRedirectTo = `${window.location.origin}${basePath}/auth/callback`;

      const { data, error } = await this.supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            username: credentials.username,
            avatar_url: '',
            role: credentials.role ?? null
          },
          emailRedirectTo
        }
      });

      if (error) {
        throw new Error(this.getFriendlyAuthError(error));
      }
      
      return { user: data.user };
    } catch (error: any) {
      console.error('Error signing up:', error);
      this.error.set(error.message || 'Error al registrarse');
      return { user: null, error };
    } finally {
      this.isLoading.set(false);
    }
  }

  async upsertProfileRole(userId: string, role: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .upsert({ id: userId, role }, { onConflict: 'id' });

      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('uniq_single_admin') || msg.includes('duplicate key') || msg.includes('unique')) {
          throw new Error('Ya existe un administrador. Solo se permite un admin.');
        }
        throw error;
      }
    } catch (e: any) {
      throw e;
    }
  }

  async loadProfileRole(userId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (error) throw error;
      const r = (data as any)?.role as 'cliente' | 'conductor' | 'admin' | null;
      this.role.set(r ?? null);
    } catch {
      this.role.set(null);
    }
  }

  async signOut(): Promise<{ error?: Error }> {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      
      this.currentUser.set(null);
      this.router.navigate(['/auth/login']);
      return {};
    } catch (error: any) {
      console.error('Error signing out:', error);
      return { error };
    }
  }

  async resetPassword(email: string): Promise<{ error?: Error }> {
    try {
      const baseHref = this.document?.baseURI || window.location.origin + '/';
      const basePath = new URL(baseHref).pathname.replace(/\/$/, '');
      const redirectTo = `${window.location.origin}${basePath}/reset-password`;

      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;
      
      return {};
    } catch (error: any) {
      console.error('Error resetting password:', error);
      this.error.set(error.message || 'Error al restablecer la contraseña');
      return { error };
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser();
  }

  isAuthenticated(): boolean {
    return !!this.currentUser();
  }

  // Exponer sesión actual de forma segura
  async getSession() {
    return this.supabase.auth.getSession();
  }

  private getFriendlyAuthError(error: AuthError): string {
    if (!error) return 'Error de autenticación';
    
    const errorMap: { [key: string]: string } = {
      'Invalid login credentials': 'Correo o contraseña incorrectos',
      'Email not confirmed': 'Por favor verifica tu correo electrónico',
      'User already registered': 'Este correo ya está registrado',
      'Weak password': 'La contraseña es demasiado débil',
      'Email rate limit exceeded': 'Demasiados intentos. Intenta de nuevo más tarde',
      'Network request failed': 'Error de conexión. Verifica tu conexión a internet',
    };
    
    return errorMap[error.message] || error.message || 'Error de autenticación';
  }
}
