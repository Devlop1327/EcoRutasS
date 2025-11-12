import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.role();
  if ((role || '').toLowerCase() === 'admin') return true;
  return router.parseUrl('/dashboard') as UrlTree;
};
