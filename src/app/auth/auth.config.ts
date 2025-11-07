import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'callback',
    loadComponent: () => import('./callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  },
  {
    path: 'forgot',
    loadComponent: () => import('./forgot/forgot.component').then(m => m.ForgotComponent)
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
