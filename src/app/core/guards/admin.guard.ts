import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';

export const adminGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Fast pass: si ya tenemos el rol cargado (por caché), permitir acceso inmediato
  const currentRole = auth.role();
  if ((currentRole || '').toLowerCase() === 'admin') return true;

  // Si no, esperar a que termine de cargar la autenticación
  return toObservable(auth.isLoading).pipe(
    filter(loading => !loading),
    take(1),
    map(() => {
      const role = auth.role();
      if ((role || '').toLowerCase() === 'admin') return true;
      return router.parseUrl('/dashboard');
    })
  );
};
