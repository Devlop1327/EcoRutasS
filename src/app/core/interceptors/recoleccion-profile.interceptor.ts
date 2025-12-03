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
    // Excepción para DELETE /api/vehiculos: el perfil_id va en el body, no en query params
    if (skipPerfilForCalles) {
      return next(req);
    }

    const PERFIL_ID = environment.profileId || '3d9cdfd5-f6cb-4d85-b18c-5dd3a2043b75';

    // Trabajar con HttpParams para evitar duplicados
    let params = req.params;
    const hasPerfilId = params.has('perfil_id');
    const hasProfileId = params.has('profile_id');

    let perfilValue = PERFIL_ID;
    if (hasPerfilId) {
      perfilValue = params.get('perfil_id') || PERFIL_ID;
    } else if (hasProfileId) {
      perfilValue = params.get('profile_id') || PERFIL_ID;
    }

    // Normaliza: usar sólo 'perfil_id'
    if (hasProfileId) {
      params = params.delete('profile_id');
    }
    if (!hasPerfilId) {
      params = params.set('perfil_id', perfilValue);
    }

    const cloned = req.clone({
      params,
      setHeaders: { 'Accept': 'application/json' }
    });
    return next(cloned);
  } catch {
    return next(req);
  }
};
