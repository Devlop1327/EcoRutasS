import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatDividerModule,
    MatProgressBarModule,
    MatSelectModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);
  showPasswordConfirm = signal(false);

  form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
    role: ['cliente', [Validators.required]],
    terms: [false, [Validators.requiredTrue]],
  });

  passwordMismatch(): boolean {
    const p = this.form.get('password')?.value;
    const c = this.form.get('confirmPassword')?.value;
    return !!p && !!c && p !== c;
  }

  passwordStrength(): number {
    const p = (this.form.get('password')?.value || '') as string;
    let score = 0;
    if (p.length >= 6) score += 25;
    if (p.length >= 10) score += 15;
    if (/[A-Z]/.test(p)) score += 20;
    if (/[a-z]/.test(p)) score += 10;
    if (/[0-9]/.test(p)) score += 15;
    if (/[^A-Za-z0-9]/.test(p)) score += 15;
    return Math.min(score, 100);
  }

  passwordStrengthColor(): 'warn' | 'accent' | 'primary' {
    const v = this.passwordStrength();
    if (v < 40) return 'warn';
    if (v < 70) return 'accent';
    return 'primary';
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    const { username, email, password, role } = this.form.getRawValue();
    try {
      const res = await this.auth.signUp({
        username: username as string,
        email: email as string,
        password: password as string,
      });

      if (res.error) throw res.error;
      if (res.user?.id && role) {
        await this.auth.upsertProfileRole(res.user.id, role as string);
      }
      await this.router.navigate(['/auth/login']);
    } catch (e: any) {
      this.error.set(e?.message || 'No se pudo registrar');
    } finally {
      this.loading.set(false);
    }
  }
}
