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
  isAdmin = computed(() => (this.auth.role() || '').toLowerCase() === 'admin');
  isConductor = computed(() => (this.auth.role() || '').toLowerCase() === 'conductor');
  isClient = computed(() => !this.isAdmin() && !this.isConductor());
  role = computed(() => {
    // Si ya tenemos un rol (por caché), mostrarlo inmediatamente
    const currentRole = this.auth.role();
    if (currentRole) return currentRole;

    // Si no, esperar a que termine de cargar
    if (this.auth.isLoading()) {
      return null;
    }
    return null;
  });



  private initAvatar(): string | null {
    try { return localStorage.getItem('avatarDataUrl'); } catch { return null; }
  }
  theme = signal<'light' | 'dark'>((localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  sidebarOpen = signal(true);
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

  get summaryStats() {
    const coverage = this.rutasCount() > 0 ? Math.min(98, 70 + Math.round(this.rutasCount() * 2.4)) : 84;
    const efficiency = this.vehiculosCount() > 0 ? Math.min(97, 73 + Math.round(this.vehiculosCount() * 1.8)) : 91;
    const activeAlerts = this.alerts.length;
    const avgMinutes = this.rutasCount() > 0 ? Math.max(18, 32 - this.rutasCount()) : 24;

    return [
      { label: 'Cobertura', value: `${coverage}%`, caption: 'de la zona operativa', icon: 'bi bi-geo-alt-fill', tone: 'emerald' },
      { label: 'Eficiencia', value: `${efficiency}%`, caption: 'cumplimiento horario', icon: 'bi bi-lightning-charge-fill', tone: 'blue' },
      { label: 'Incidencias', value: String(activeAlerts).padStart(2, '0'), caption: 'alertas pendientes', icon: 'bi bi-exclamation-triangle-fill', tone: 'amber' },
      { label: 'Tiempo medio', value: `${avgMinutes}m`, caption: 'por recorrido', icon: 'bi bi-stopwatch-fill', tone: 'violet' }
    ];
  }

  get recentRoutes() {
    const rutas = this.rutasData();
    if (rutas.length > 0) {
      return rutas.slice(0, 4).map((ruta, index) => {
        const estadoRaw = ruta?.estado ? String(ruta.estado) : ruta?.activo === false ? 'inactivo' : 'activo';
        const status = this.normalizeRouteStatus(estadoRaw, index);
        const time = ruta.updated_at
          ? new Date(ruta.updated_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
          : ['08:30', '09:00', '07:45', '10:15'][index] ?? '09:00';
        const vehicles = Math.max(1, Math.min(6, (this.vehiculosCount() || 3) - index));

        return {
          name: ruta.nombre || `Ruta ${index + 1}`,
          status,
          time,
          vehicles
        };
      });
    }

    return [
      { name: 'Ruta centro', status: 'En curso', time: '08:30', vehicles: 4 },
      { name: 'Ruta sur', status: 'Programada', time: '09:00', vehicles: 3 },
      { name: 'Ruta norte', status: 'Completada', time: '07:45', vehicles: 2 },
      { name: 'Ruta industrial', status: 'En revisión', time: '10:15', vehicles: 5 }
    ];
  }

  get alerts() {
    const inactive = this.vehiculosData().filter((v: any) => v.activo === false || v.activo === 'false');
    if (inactive.length > 0) {
      return inactive.slice(0, 3).map((v: any, index: number) => ({
        title: 'Vehículo inactivo',
        detail: `${v.placa || v.id || 'Vehículo'} requiere revisión`,
        level: index === 0 ? 'alta' : index === 1 ? 'media' : 'baja'
      }));
    }

    if (this.rutasCount() > 0) {
      return [
        { title: 'Flota operativa', detail: `${this.vehiculosCount()} vehículos activos en ruta`, level: 'baja' },
        { title: 'Cobertura estable', detail: `${this.rutasCount()} rutas programadas hoy`, level: 'media' },
        { title: 'Sin incidencias', detail: 'La operación se mantiene dentro del plan', level: 'baja' }
      ];
    }

    return [
      { title: 'Sin alertas', detail: 'Sin incidencias registradas', level: 'baja' },
      { title: 'Operación estable', detail: 'El sistema está sincronizado', level: 'media' },
      { title: 'Monitoreo activo', detail: 'Todo listo para operar', level: 'baja' }
    ];
  }

  @ViewChild('adminVehChart') adminVehChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('adminRutasChart') adminRutasChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('adminMiniMap') adminMiniMap?: ElementRef<HTMLCanvasElement>;
  @ViewChild('clientVehChart') clientVehChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('clientRutasChart') clientRutasChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('clientMiniMap') clientMiniMap?: ElementRef<HTMLCanvasElement>;

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
      await this.loadDashboardData();
    } catch (e: any) {
      console.error('Error cargando datos del dashboard:', e);
    } finally {
      this.loading.set(false);
      setTimeout(() => this.drawAll(), 0);
      this.pollId = window.setInterval(async () => {
        try {
          await this.loadDashboardData();
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

  toggleSidebar() {
    this.sidebarOpen.update((value) => !value);
  }

  private async loadDashboardData() {
    const rutasSource = this.admin.listRutas().catch(async () => await this.reco.getRutas().catch(() => []));
    const vehiculosSource = this.admin.listVehiculos().catch(async () => await this.reco.getVehiculos().catch(() => []));

    const [rutas, vehiculos] = await Promise.all([rutasSource, vehiculosSource]);
    const rutasNorm = Array.isArray(rutas) ? rutas : [];
    const vehiculosNorm = Array.isArray(vehiculos) ? vehiculos : [];

    const activeRoutes = rutasNorm.filter((ruta: any) => ruta?.activo !== false && String(ruta?.estado ?? '').toLowerCase() !== 'inactivo');
    const activeVehicles = vehiculosNorm.filter((vehiculo: any) => vehiculo?.activo !== false && String(vehiculo?.estado ?? '').toLowerCase() !== 'inactivo');

    this.rutasData.set(rutasNorm);
    this.vehiculosData.set(vehiculosNorm);
    this.rutasCount.set(activeRoutes.length || rutasNorm.length || 0);
    this.vehiculosCount.set(activeVehicles.length || vehiculosNorm.length || 0);
    this.vehTrend.set(this.makeTrend(this.vehiculosCount(), 1));
    this.rutasTrend.set(this.makeTrend(this.rutasCount(), 3));

    if (this.adminVehChart?.nativeElement || this.adminRutasChart?.nativeElement || this.clientVehChart?.nativeElement || this.clientRutasChart?.nativeElement) {
      this.drawAll();
    }
    this.drawMiniMap();
  }

  private normalizeRouteStatus(estado: string, index: number): string {
    const state = String(estado || '').trim().toLowerCase();
    if (state.includes('curso') || state.includes('activo') || state.includes('running')) return 'En curso';
    if (state.includes('program') || state.includes('pendiente')) return 'Programada';
    if (state.includes('complet') || state.includes('finaliz')) return 'Completada';
    if (state.includes('revis') || state.includes('alert')) return 'En revisión';
    return ['En curso', 'Programada', 'Completada', 'En revisión'][index % 4] ?? 'Programada';
  }

  private makeTrend(base: number, phase = 0) {
    const arr: number[] = [];
    const safeBase = Math.max(1, base);

    for (let i = 0; i < 16; i++) {
      const oscillation = Math.sin((i + 1 + phase) * 0.9) * 0.18;
      const delta = Math.round(safeBase * oscillation + (i - 7) * 0.08);
      arr.push(Math.max(0, safeBase + delta));
    }

    arr[arr.length - 1] = safeBase;
    return arr;
  }

  private pushTrend(sig: ReturnType<typeof signal<number[]>>, next: number) {
    const curr = sig();
    const updated = [...curr, next];
    while (updated.length > 16) updated.shift();
    sig.set(updated);
  }

  private drawAll() {
    const vehCanvases = [this.adminVehChart?.nativeElement, this.clientVehChart?.nativeElement].filter(Boolean) as HTMLCanvasElement[];
    const rutaCanvases = [this.adminRutasChart?.nativeElement, this.clientRutasChart?.nativeElement].filter(Boolean) as HTMLCanvasElement[];

    for (const canvas of vehCanvases) this.drawSpark(canvas, this.vehTrend(), '#059669');
    for (const canvas of rutaCanvases) this.drawSpark(canvas, this.rutasTrend(), '#2563eb');
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
    const canvases = [this.adminMiniMap?.nativeElement, this.clientMiniMap?.nativeElement].filter(Boolean) as HTMLCanvasElement[];
    if (!canvases.length) return;

    for (const canvas of canvases) {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth || 260; const cssH = canvas.clientHeight || 120;
      canvas.width = Math.floor(cssW * dpr); canvas.height = Math.floor(cssH * dpr);
      const ctx = canvas.getContext('2d'); if (!ctx) continue; ctx.scale(dpr, dpr);
      const w = cssW, h = cssH;

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
        if (points.length > 1) {
          ctx.strokeStyle = '#059669'; ctx.lineWidth = 2; ctx.beginPath();
          points.forEach((p, i) => { const { x, y } = proj(p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
          ctx.stroke();
        }
        ctx.fillStyle = '#10b981';
        vehPoints.forEach(p => { const { x, y } = proj(p); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });
      } else {
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
}
