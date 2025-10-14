import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-callback.component.html',
  styleUrls: ['./auth-callback.component.scss']
})
export class AuthCallbackComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  status = signal<'checking' | 'ok' | 'error'>('checking');

  async ngOnInit() {
    try {
      const { data: { session }, error } = await this.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        this.status.set('ok');
        setTimeout(() => this.router.navigate(['/dashboard']), 400);
      } else {
        this.status.set('error');
        setTimeout(() => this.router.navigate(['/auth/login']), 600);
      }
    } catch (e) {
      this.status.set('error');
      setTimeout(() => this.router.navigate(['/auth/login']), 600);
    }
  }
}
