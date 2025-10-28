import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
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
    MatProgressSpinnerModule,
    RouterLink
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  showPassword = signal(false);
  loading = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
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
