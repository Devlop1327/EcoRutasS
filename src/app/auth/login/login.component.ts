import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { animate, style, transition, trigger, state } from '@angular/animations';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  animations: [trigger('fadeSlideInOut', [transition(':enter', [style({ opacity: 0, transform: 'translateY(20px)' }), animate('0.3s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))])]), trigger('rotateIcon', [state('in', style({ transform: 'rotate(0deg)' })), state('out', style({ transform: 'rotate(360deg)' })), transition('in => out', animate('0.5s ease-in-out')), transition('out => in', animate('0.5s ease-in-out'))])],
  host: {
    class: 'app-login'
  }
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  mode = signal<'login' | 'register'>('login');

  roleOptions = ['cliente', 'conductor'];
  passwordStrength = computed(() => {
    const v = this.registerForm.controls.password.value || '';
    let score = 0;
    if (v.length >= 6) score += 25;
    if (/[A-Z]/.test(v)) score += 25;
    if (/[0-9]/.test(v)) score += 25;
    if (/[^A-Za-z0-9]/.test(v)) score += 25;
    return score;
  });

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true]
  });

  registerForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['cliente', [Validators.required]]
  });

  togglePassword() {
    this.showPassword.update(show => !show);
  }

  async onSubmit() {
    if (this.loading()) return;
    if (this.mode() === 'login') {
      if (this.loginForm.invalid) return;
      this.loading.set(true);
      try {
        const { email, password } = this.loginForm.getRawValue();
        await this.authService.signIn({ email, password });
        this.error.set(null);
      } catch (error: any) {
        this.error.set(error?.message || 'Error al iniciar sesión. Verifica tus credenciales.');
      } finally {
        this.loading.set(false);
      }
    } else {
      if (this.registerForm.invalid) return;
      this.loading.set(true);
      try {
        const { username, email, password, role } = this.registerForm.getRawValue();
        const roleVal = (role ?? 'cliente') as 'cliente' | 'conductor' | 'admin';
        const res = await this.authService.signUp({ username, email, password, role: roleVal });
        if (res.error) throw res.error;
        this.error.set(null);
        await this.router.navigate(['/auth/login']);
        this.mode.set('login');
      } catch (error: any) {
        this.error.set(error?.message || 'No se pudo registrar');
      } finally {
        this.loading.set(false);
      }
    }
  }

  async signInWithGoogle() {
    if (this.loading()) return;
    
    this.loading.set(true);

    const { error } = await this.authService.signInWithGoogle();

    if (error) {
      console.error('Error al iniciar con Google:', error);
      this.error.set(error.message || 'Error al iniciar sesión con Google');
      this.loading.set(false);
      return;
    }
    // En éxito, Supabase redirige a /auth/callback automáticamente.
    // Mantenemos el loading hasta que el navegador redirija.
  }

  switchMode(next: 'login' | 'register') {
    this.mode.set(next);
  }
}




