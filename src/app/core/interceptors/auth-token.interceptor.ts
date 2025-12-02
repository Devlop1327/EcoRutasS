import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

// Adjunta Authorization: Bearer <access_token Supabase> y Accept: application/json
// a las requests dirigidas a la API de recolección (host directo o proxy).
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const apiBase = environment.recoleccionApiUrl?.replace(/\/$/, '');
  const proxyBase = (environment as any).recoleccionApiProxy || '/recoleccion';
  if (!apiBase) return next(req);

  const auth = inject(AuthService);

  try {
    const reqUrl = new URL(req.url, window.location.origin);
    const apiUrl = new URL(apiBase);

    const isSameHost = reqUrl.host === apiUrl.host;
    const isProxyPath = reqUrl.pathname.startsWith(proxyBase);
    if (!isSameHost && !isProxyPath) {
      return next(req);
    }

    // Usar token cacheado síncronamente para evitar bloqueos (NavigatorLockAcquireTimeoutError)
    const token = auth.accessToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const cloned = req.clone({ setHeaders: headers });
    return next(cloned);
  } catch {
    return next(req);
  }
};
