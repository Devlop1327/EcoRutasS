import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './auth/auth.config';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'mapa',
    loadComponent: () => import('./map/mapa.component').then(m => m.MapaComponent)
  },
  {
    path: 'perfil',
    loadComponent: () => import('./perfil/perfil.component').then(m => m.PerfilComponent)
  },
  {
    path: 'auth',
    children: AUTH_ROUTES
  },
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'auth'
  }
];
