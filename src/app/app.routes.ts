import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './auth/auth.config';
import { adminGuard } from './core/guards/admin.guard';

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
    path: 'admin',
    loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent),
    canMatch: [adminGuard],
    children: [
      {
        path: 'vehiculos',
        loadComponent: () => import('./admin/vehiculos/vehiculos.component').then(m => m.VehiculosComponent)
      },
      {
        path: 'rutas',
        loadComponent: () => import('./admin/rutas/rutas.component').then(m => m.RutasComponent)
      },
      {
        path: 'rutas/editor',
        loadComponent: () => import('./admin/rutas/editor-ruta.component').then(m => m.EditorRutaComponent)
      },
      { path: '', redirectTo: 'vehiculos', pathMatch: 'full' }
    ]
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
