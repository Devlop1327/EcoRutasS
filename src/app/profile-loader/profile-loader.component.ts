import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { Router } from '@angular/router';

/**
 * Componente que espera a que el perfil de Supabase se cargue
 * antes de permitir navegación a otras rutas.
 * Se muestra como Splash/Loading mientras se obtiene el perfil.
 */
@Component({
  selector: 'app-profile-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-loader-container">
      <div class="loader-content">
        <div class="spinner"></div>
        <h2>Cargando perfil...</h2>
        <p class="subtitle">{{ loadingMessage }}</p>
      </div>
    </div>
  `,
  styles: [`
    .profile-loader-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    .loader-content {
      text-align: center;
      color: white;
    }

    .spinner {
      width: 60px;
      height: 60px;
      margin: 0 auto 30px;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top: 4px solid rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    h2 {
      margin: 0 0 10px;
      font-size: 24px;
      font-weight: 600;
    }

    .subtitle {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
  `]
})
export class ProfileLoaderComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  loadingMessage = 'Por favor espera mientras cargamos tu perfil...';

  ngOnInit() {
    // Verificar si hay sesión activa
    const currentUser = this.auth.currentUser();
    if (!currentUser) {
      // Sin sesión activa, redirigir al login
      this.router.navigate(['/auth/login']).catch(err => {
        console.error('[ProfileLoader] Navigation error:', err);
      });
      return;
    }

    // Esperar a que el perfil esté cargado
    const checkProfile = setInterval(() => {
      const profile = this.auth.profile();
      if (profile !== null) {
        // Perfil cargado (puede ser un objeto o null si no existe)
        clearInterval(checkProfile);
        this.router.navigate(['/dashboard']).catch(err => {
          console.error('[ProfileLoader] Navigation error:', err);
        });
      }
    }, 500);

    // Timeout de 10 segundos - si no carga el perfil, ir al dashboard de todas formas
    setTimeout(() => {
      clearInterval(checkProfile);
      console.warn('[ProfileLoader] Profile load timeout, navigating to dashboard anyway');
      this.router.navigate(['/dashboard']).catch(err => {
        console.error('[ProfileLoader] Navigation error:', err);
      });
    }, 10000);
  }
}
