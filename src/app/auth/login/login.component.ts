import { Component, signal, inject } from '@angular/core';
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
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true]
  });

  togglePassword() {
    this.showPassword.update(show => !show);
  }

  async onSubmit() {
    if (this.loading() || this.form.invalid) return;
    
    this.loading.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.authService.signIn({ email, password });
      
      this.snackBar.open('¡Bienvenido!', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      });
      
      // AuthService ya navega a /dashboard
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      this.snackBar.open(
        error.message || 'Error al iniciar sesión. Verifica tus credenciales.',
        'Cerrar',
        {
          duration: 5000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        }
      );
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithGoogle() {
    if (this.loading()) return;
    
    this.loading.set(true);
    this.snackBar.dismiss(); // Cerrar cualquier snackbar abierto

    const { error } = await this.authService.signInWithGoogle();

    if (error) {
      console.error('Error al iniciar con Google:', error);
      this.showError(error.message || 'Error al iniciar sesión con Google');
      this.loading.set(false);
      return;
    }
    // En éxito, Supabase redirige a /auth/callback automáticamente.
    // Mantenemos el loading hasta que el navegador redirija.
  }

  // Método para manejar errores de formulario
  private showError(message: string) {
    this.snackBar.open(message, 'Cerrar', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }

  // Método para manejar éxito en operaciones
  private showSuccess(message: string) {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['success-snackbar']
    });
  }
}




