import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Tema inicial: usa localStorage o prefers-color-scheme
(() => {
  try {
    const saved = (localStorage.getItem('theme') as 'light' | 'dark' | null);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved ?? (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', initial === 'dark');
  } catch {}
})();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
