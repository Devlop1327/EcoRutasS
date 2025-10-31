import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { recoleccionProfileInterceptor } from './core/interceptors/recoleccion-profile.interceptor';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([
      authTokenInterceptor,
      recoleccionProfileInterceptor
    ])),
    provideAnimations(),
    provideZoneChangeDetection({
      eventCoalescing: true,
      runCoalescing: true
    })
  ]
};
