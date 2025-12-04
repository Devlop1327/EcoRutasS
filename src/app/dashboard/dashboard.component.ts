import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { RecoleccionService } from '../core/services/recoleccion.service';
import { AdminDataService } from '../core/services/admin-data.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private auth = inject(AuthService);
  private reco = inject(RecoleccionService);
  private admin = inject(AdminDataService);
  private router = inject(Router);

  loading = signal(true);
  userName = computed(() => {
    const user = this.auth.currentUser();
    return user?.email?.split('@')[0] || 'Usuario';
  });
  avatar = signal<string | null>(this.initAvatar());
  rutasCount = signal(0);
  vehiculosCount = signal(0);
  error = signal<string | null>(null);
  role = computed(() => {
    // Esperar a que la autenticación termine de cargar antes de mostrar el rol
    if (this.auth.isLoading()) {
      return null;
    }
    return this.auth.role();
  });



  private initAvatar(): string | null {
    try { return localStorage.getItem('avatarDataUrl'); } catch { return null; }
  }
  theme = signal<'light' | 'dark'>((localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return '¡Buenos días';
    if (h < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  });
  vehTrend = signal<number[]>([]);
  rutasTrend = signal<number[]>([]);
  rutasData = signal<any[]>([]);
  vehiculosData = signal<any[]>([]);

  @ViewChild('vehChart') vehChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('rutasChart') rutasChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('miniMap') miniMap?: ElementRef<HTMLCanvasElement>;

  private pollId?: number;

  async ngOnInit() {
    if (!localStorage.getItem('theme')) {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.theme.set(prefersDark ? 'dark' : 'light');
    }
    // Aplicar clase global según tema actual
    try { document.documentElement.classList.toggle('dark', this.theme() === 'dark'); } catch { }

    window.addEventListener('keydown', this.onKey);

    try {
      const [rutas, vehiculos] = await Promise.all([
        this.reco.getRutas().catch(() => []),
        this.reco.getVehiculos().catch(() => [])
      ]);
      this.rutasCount.set(rutas.length);
      this.vehiculosCount.set(vehiculos.length);
      this.rutasData.set(rutas);
      this.vehiculosData.set(vehiculos);
      this.vehTrend.set(this.makeTrend(this.vehiculosCount()));
      this.rutasTrend.set(this.makeTrend(this.rutasCount()));
    } catch (e: any) {
      console.error('Error cargando datos:', e);
      // No mostramos error, solo dejamos los contadores en 0
    } finally {
      this.loading.set(false);
      setTimeout(() => this.drawAll(), 0);
      // Polling cada 15s
      this.pollId = window.setInterval(async () => {
        try {
          const [rutas, vehiculos] = await Promise.all([
            this.reco.getRutas().catch(() => []),
            this.reco.getVehiculos().catch(() => [])
          ]);
          const rc = rutas.length; const vc = vehiculos.length;
          this.rutasCount.set(rc); this.vehiculosCount.set(vc);
          this.rutasData.set(rutas); this.vehiculosData.set(vehiculos);
          this.pushTrend(this.vehTrend, vc);
          this.pushTrend(this.rutasTrend, rc);
          this.drawAll();
          this.drawMiniMap();
        } catch { }
      }, 15000);
    }
    // Escuchar cambios de avatar (por ejemplo cuando se actualiza en perfil)
    try { window.addEventListener('avatar-changed', () => { this.avatar.set(localStorage.getItem('avatarDataUrl')); }); } catch { }
  }

  ngAfterViewInit() {
    this.drawAll();
    this.drawMiniMap();
  }

  async logout() {
    await this.auth.signOut();
  }

  toggleTheme() {
    const next = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(next);
    localStorage.setItem('theme', next);
    try { document.documentElement.classList.toggle('dark', next === 'dark'); } catch { }
  }

  private makeTrend(base: number) {
    const arr: number[] = [];
    let v = Math.max(0, base - 3);
    for (let i = 0; i < 16; i++) {
      v = Math.max(0, v + Math.round((Math.random() - 0.5) * 2));
      arr.push(v);
    }
    arr[arr.length - 1] = base;
    return arr;
  }

  private pushTrend(sig: ReturnType<typeof signal<number[]>>, next: number) {
    const curr = sig();
    const updated = [...curr, next];
    while (updated.length > 16) updated.shift();
    sig.set(updated);
  }

  private drawAll() {
    if (this.vehChart?.nativeElement) this.drawSpark(this.vehChart.nativeElement, this.vehTrend(), '#059669');
    if (this.rutasChart?.nativeElement) this.drawSpark(this.rutasChart.nativeElement, this.rutasTrend(), '#2563eb');
  }

  private drawSpark(canvas: HTMLCanvasElement, data: number[], color: string) {
    if (!canvas || !data?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const w = cssW, h = cssH, pad = 4;
    const max = Math.max(...data, 1), min = Math.min(...data, 0);
    const norm = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = norm(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    const lastX = pad + ((data.length - 1) / (data.length - 1)) * (w - pad * 2);
    const lastY = norm(data[data.length - 1]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.target && (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA|SELECT/)) return;
    if (e.key.toLowerCase() === 'g') this.router.navigateByUrl('/mapa');
    if (e.key.toLowerCase() === 'p') this.router.navigateByUrl('/perfil');
    if (e.key.toLowerCase() === 'l') this.logout();
  };

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.onKey);
    if (this.pollId) window.clearInterval(this.pollId);
  }

  private drawMiniMap() {
    const canvas = this.miniMap?.nativeElement; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 260; const cssH = canvas.clientHeight || 120;
    canvas.width = Math.floor(cssW * dpr); canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(dpr, dpr);
    const w = cssW, h = cssH;

    // Fondo y marco
    const grd = ctx.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#e0f2fe'); grd.addColorStop(1, '#f0fdf4');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d1d5db'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    const rutas = this.rutasData();
    const vehs = this.vehiculosData();
    let points: Array<{ lat: number; lng: number }> = [];
    const ruta = rutas.find(r => Array.isArray(r.coordenadas) && r.coordenadas.length > 1);
    if (ruta) {
      points = ruta.coordenadas.map((p: any) => ({ lat: Number(p[0]), lng: Number(p[1]) }));
    }

    // Calcular bounds con puntos de ruta y vehículos
    const vehPoints = (vehs || []).filter(v => v.lat != null && v.lng != null).map(v => ({ lat: Number(v.lat), lng: Number(v.lng) }));
    const allPts = points.concat(vehPoints);
    if (allPts.length >= 1) {
      const minLat = Math.min(...allPts.map(p => p.lat));
      const maxLat = Math.max(...allPts.map(p => p.lat));
      const minLng = Math.min(...allPts.map(p => p.lng));
      const maxLng = Math.max(...allPts.map(p => p.lng));
      const pad = 8;
      const proj = (p: { lat: number; lng: number }) => {
        const x = pad + ((p.lng - minLng) / ((maxLng - minLng) || 1)) * (w - pad * 2);
        const y = pad + (1 - (p.lat - minLat) / ((maxLat - minLat) || 1)) * (h - pad * 2);
        return { x, y };
      };
      // Ruta
      if (points.length > 1) {
        ctx.strokeStyle = '#059669'; ctx.lineWidth = 2; ctx.beginPath();
        points.forEach((p, i) => { const { x, y } = proj(p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke();
      }
      // Vehículos
      ctx.fillStyle = '#10b981';
      vehPoints.forEach(p => { const { x, y } = proj(p); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });
    } else {
      // Fallback estilizado en Buenaventura
      const cx = w * 0.55, cy = h * 0.55;
      ctx.strokeStyle = '#059669'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(w * 0.15, h * 0.75);
      ctx.bezierCurveTo(w * 0.35, h * 0.55, w * 0.45, h * 0.85, cx, cy);
      ctx.bezierCurveTo(w * 0.7, h * 0.35, w * 0.85, h * 0.5, w * 0.9, h * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}
