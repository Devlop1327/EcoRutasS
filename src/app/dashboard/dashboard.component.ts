import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { RecoleccionService } from '../core/services/recoleccion.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private reco = inject(RecoleccionService);
  private router = inject(Router);

  loading = signal(true);
  userName = signal<string>('Usuario');
  rutasCount = signal(0);
  vehiculosCount = signal(0);
  error = signal<string | null>(null);

  async ngOnInit() {
    const user = this.auth.getCurrentUser();
    if (user) {
      this.userName.set(user.email?.split('@')[0] || 'Usuario');
    }

    try {
      const [rutas, vehiculos] = await Promise.all([
        this.reco.getRutas().catch(() => []),
        this.reco.getVehiculos().catch(() => [])
      ]);
      this.rutasCount.set(rutas.length);
      this.vehiculosCount.set(vehiculos.length);
    } catch (e: any) {
      console.error('Error cargando datos:', e);
      // No mostramos error, solo dejamos los contadores en 0
    } finally {
      this.loading.set(false);
    }
  }

  async logout() {
    await this.auth.signOut();
  }
}
