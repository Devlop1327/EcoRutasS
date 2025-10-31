import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Agrega ?perfil_id=<uuid> a todas las requests que vayan al dominio de la API de recolección
export const recoleccionProfileInterceptor: HttpInterceptorFn = (req, next) => {
  const apiBase = environment.recoleccionApiUrl?.replace(/\/$/, '');
  const proxyBase = (environment as any).recoleccionApiProxy || '/recoleccion';
  if (!apiBase) return next(req);

  try {
    const reqUrl = new URL(req.url, window.location.origin);
    const apiUrl = new URL(apiBase);

    const isSameHost = reqUrl.host === apiUrl.host;
    const isProxyPath = reqUrl.pathname.startsWith(proxyBase);
    if (!isSameHost && !isProxyPath) {
      return next(req);
    }

    // Normaliza path real bajo /api aunque venga por proxy /recoleccion
    const pathFromProxy = isProxyPath ? reqUrl.pathname.substring(proxyBase.length) || '/' : reqUrl.pathname;
    const normalizedPath = pathFromProxy.startsWith('/api') ? pathFromProxy : `/api${pathFromProxy}`;

    // ÚNICA excepción: /api/calles NO requiere perfil_id
    const skipPerfilForCalles = normalizedPath.startsWith('/api/calles');
    if (skipPerfilForCalles) {
      return next(req);
    }

    const PERFIL_ID = environment.profileId || '3d9cdfd5-f6cb-4d85-b18c-5dd3a2043b75';

    // Normaliza: la API exige 'perfil_id'. Quitamos 'profile_id' si vino y no duplicamos.
    if (reqUrl.searchParams.has('profile_id') && !reqUrl.searchParams.has('perfil_id')) {
      const prev = reqUrl.searchParams.get('profile_id') || PERFIL_ID;
      reqUrl.searchParams.delete('profile_id');
      reqUrl.searchParams.set('perfil_id', prev);
    }
    if (!reqUrl.searchParams.has('perfil_id')) {
      reqUrl.searchParams.set('perfil_id', PERFIL_ID);
    }

    const cloned = req.clone({
      url: reqUrl.toString(),
      setHeaders: { 'x-perfil-id': PERFIL_ID, 'Accept': 'application/json' }
    });
    return next(cloned);
  } catch {
    return next(req);
  }
};
