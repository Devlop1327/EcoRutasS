import { Component, signal, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { animate, style, transition, trigger, state } from '@angular/animations';
import { AuthService } from '../../core/services/auth.service';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
    MatSelectModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  animations: [trigger('fadeSlideInOut', [transition(':enter', [style({ opacity: 0, transform: 'translateY(20px)' }), animate('0.3s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))])]), trigger('rotateIcon', [state('in', style({ transform: 'rotate(0deg)' })), state('out', style({ transform: 'rotate(360deg)' })), transition('in => out', animate('0.5s ease-in-out')), transition('out => in', animate('0.5s ease-in-out'))])],
  host: {
    class: 'app-login'
  }
})
export class LoginComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  mode = signal<'login' | 'register'>('login');

  roleOptions = ['cliente', 'conductor'];
  
  currentImageIndex = signal(1);
  private carouselInterval: any;

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

  ngOnInit() {
    this.startCarousel();
  }

  ngOnDestroy() {
    this.stopCarousel();
  }

  private startCarousel() {
    this.carouselInterval = setInterval(() => {
      const nextIndex = this.currentImageIndex() === 5 ? 1 : this.currentImageIndex() + 1;
      this.currentImageIndex.set(nextIndex);
    }, 5000);
  }

  private stopCarousel() {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
    }
  }

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
        this.snackBar.open('Â¡Bienvenido!', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        });
      } catch (error: any) {
        this.snackBar.open(
          error?.message || 'Error al iniciar sesiÃ³n. Verifica tus credenciales.',
          'Cerrar',
          { duration: 5000, horizontalPosition: 'center', verticalPosition: 'top', panelClass: ['error-snackbar'] }
        );
      } finally {
        this.loading.set(false);
      }
    } else {
      if (this.registerForm.invalid) return;
      this.loading.set(true);
      try {
        const { username, email, password, role } = this.registerForm.getRawValue();
        const res = await this.authService.signUp({ username, email, password });
        if (res.error) throw res.error;
        if (res.user?.id && role) {
          await this.authService.upsertProfileRole(res.user.id, role);
        }
        this.snackBar.open('Cuenta creada. Revisa tu correo para verificar.', 'Cerrar', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        });
        await this.router.navigate(['/auth/login']);
        this.mode.set('login');
      } catch (error: any) {
        this.snackBar.open(error?.message || 'No se pudo registrar', 'Cerrar', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        });
      } finally {
        this.loading.set(false);
      }
    }
  }

  async signInWithGoogle() {
    if (this.loading()) return;
    
    this.loading.set(true);
    this.snackBar.dismiss();

    const { error } = await this.authService.signInWithGoogle();

    if (error) {
      console.error('Error al iniciar con Google:', error);
      this.showError(error.message || 'Error al iniciar sesiÃ³n con Google');
      this.loading.set(false);
      return;
    }
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Cerrar', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }

  private showSuccess(message: string) {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['success-snackbar']
    });
  }

  switchMode(next: 'login' | 'register') {
    this.mode.set(next);
  }
}