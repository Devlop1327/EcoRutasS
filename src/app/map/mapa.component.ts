import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecoleccionService } from '../core/services/recoleccion.service';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ApiService, type UUID } from '../services/api.service';
import { ConductorOnlyDirective } from '../core/directives/conductor-only.directive';
import { environment } from '../../environments/environment';
import { AdminDataService } from '../core/services/admin-data.service';

// Coordenadas aproximadas de Buenaventura, Colombia
const BV_COORDS: [number, number] = [3.882, -77.031];
const BV_BOUNDS: [[number, number], [number, number]] = [[3.70, -77.25], [4.05, -76.85]];

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, ConductorOnlyDirective],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss']
})
export class MapaComponent implements OnInit, OnDestroy {
  private reco = inject(RecoleccionService);
  private api = inject(ApiService);
  private admin = inject(AdminDataService);

  loading = signal(true);
  error = signal<string | null>(null);
  rutas = signal<Array<{ id: string; nombre: string; coordenadas?: Array<[number, number]>; source?: 'api' | 'supa'; ext_id?: string | null }>>([]);
  vehiculos = signal<Array<{ id: string; placa?: string; lat?: number; lng?: number }>>([]);

  // Selección para iniciar/finalizar (solo conductor)
  selectedRutaId = signal<UUID | null>(null);
  selectedVehiculoId = signal<UUID | null>(null);
  currentRecorridoId = signal<UUID | null>(null);
  currentRecorridoRutaName = signal<string | null>(null);
  isStarting = signal(false);

  private leafletLoaded = false;
  private map: any | null = null;
  private selectedRutaLayer: any | null = null;
  private liveMarker: any | null = null;
  private posWatchId: number | null = null;
  private liveCentered = false;
  private meIcon: any | null = null;
  private posIntervalId: number | null = null;
  private lastPos: { lat: number; lon: number } | null = null;

  async ngOnInit() {
    try {
      await this.loadLeafletFromCdn();
      this.initMap();
      await Promise.all([this.loadRutas(), this.loadVehiculos()]);
      // No dibujar todas las rutas; solo cuando el usuario seleccione
      this.drawVehiculos();
      await this.checkRecorridoActivo();
    } catch (e: any) {
      this.error.set(e?.message || 'Error cargando el mapa');
    } finally {
      this.loading.set(false);
    }
  }

  private checkRecorridoActivo = async (): Promise<void> => {
    try {
      const vehId = this.selectedVehiculoId();
      if (!vehId) return;
      const lista = await this.reco.misRecorridos();
      const activos = (lista || []).filter((r: any) => {
        const vOk = String(r.vehiculo_id || r.vehicle_id || r.vehiculo || '') === String(vehId);
        const noFin = (r.finalizado === false) || (r.estado && String(r.estado).toLowerCase() !== 'finalizado') || (r.end_at == null) || (r.fin == null);
        return vOk && noFin;
      });
      if (!activos.length) {
        this.currentRecorridoId.set(null);
        this.currentRecorridoRutaName.set(null);
        return;
      }
      const activo = activos[0];
      const recId = (activo.id || activo.recorrido_id) as UUID | null;
      let rutaName: string | null = activo.ruta_nombre || activo.ruta || null;
      if (!rutaName) {
        const rid = String(activo.ruta_id || activo.route_id || '');
        const r = this.rutas().find(x => x.id === rid);
        rutaName = r?.nombre || null;
      }
      this.currentRecorridoId.set(recId || null);
      this.currentRecorridoRutaName.set(rutaName);
    } catch (e) {
      // silencioso
    }
  };

  ngOnDestroy() {
    if (this.map && this.map.remove) {
      this.map.remove();
      this.map = null;
    }
    this.stopLiveTracking();
  }

  private async loadRutas() {
    try {
      const [apiRutas, supa] = await Promise.all([
        this.reco.getRutas(),
        this.admin.listRutas().catch(() => [])
      ]);

      const apiMapped = (apiRutas || []).map(r => ({
        id: String(r.id || ''),
        nombre: String(r.nombre || 'Ruta'),
        coordenadas: r.coordenadas,
        source: 'api' as const
      })).filter(r => !!r.id);

      const supaMapped = (supa as any[] || []).map((r: any) => ({
        id: String(r.id || ''),
        nombre: String(r.nombre || 'Ruta'),
        coordenadas: r.coordenadas || (r.geometria?.type === 'LineString' && Array.isArray(r.geometria.coordinates)
          ? r.geometria.coordinates.map((c: any) => [Number(c[1]), Number(c[0])])
          : undefined),
        source: 'supa' as const,
        ext_id: r.ext_id || null
      })).filter(r => !!r.id);

      const byName = new Map<string, { id: string; nombre: string; coordenadas?: Array<[number, number]>; source?: 'api' | 'supa'; ext_id?: string | null }>();
      for (const r of apiMapped) byName.set(r.nombre.toLowerCase(), r);
      for (const r of supaMapped) {
        const key = r.nombre.toLowerCase();
        if (!byName.has(key)) byName.set(key, r);
      }

      this.rutas.set(Array.from(byName.values()));

      // Sincronizar: asegurar respaldo en Supabase de rutas que existen en la API pero no en Supabase
      const supaNames = new Set(supaMapped.map(r => r.nombre.toLowerCase()));
      const missingInSupa = apiMapped.filter(r => !supaNames.has(r.nombre.toLowerCase()) && r.coordenadas && r.coordenadas.length > 1);
      if (missingInSupa.length) {
        const toCreate = missingInSupa.map(r => ({
          nombre: r.nombre,
          geometria: { type: 'LineString', coordinates: r.coordenadas!.map(p => [p[1], p[0]]) },
          coordenadas: r.coordenadas
        }));
        try {
          await Promise.allSettled(toCreate.map(body => this.admin.createRuta(body as any)));
        } catch {}
      }
    } catch (e: any) {
      this.error.set(e?.message || 'No se pudieron cargar las rutas');
    }
  }

  private async loadVehiculos() {
    try {
      const vehiculos = await this.reco.getVehiculos();
      this.vehiculos.set(vehiculos);
    } catch (e: any) {
      console.error('Error cargando vehículos:', e);
    }
  }

  private drawSelectedRuta(ruta: { id: string; nombre: string; coordenadas?: Array<[number, number]> } | null) {
    const L: any = (window as any).L;
    if (!L || !this.map) return;
    if (this.selectedRutaLayer) {
      try { this.map.removeLayer(this.selectedRutaLayer); } catch {}
      this.selectedRutaLayer = null;
    }
    if (!ruta || !ruta.coordenadas || ruta.coordenadas.length < 2) return;
    this.selectedRutaLayer = L.polyline(ruta.coordenadas, {
      color: '#10b981',
      weight: 5,
      opacity: 0.9
    }).addTo(this.map).bindPopup(ruta.nombre);
    try { this.map.fitBounds(this.selectedRutaLayer.getBounds(), { padding: [24, 24] }); } catch {}
  }

  private drawVehiculos() {
    const L: any = (window as any).L;
    if (!L || !this.map) return;

    const truckIcon = L.icon({
      iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13"/>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      `),
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });

    for (const v of this.vehiculos()) {
      if (v.lat && v.lng) {
        L.marker([v.lat, v.lng], { icon: truckIcon })
          .addTo(this.map)
          .bindPopup(`Vehículo: ${v.placa || v.id}`);
      }
    }
  }

  private async loadLeafletFromCdn(): Promise<void> {
    if (this.leafletLoaded) return;

    await new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('No se pudo cargar Leaflet CSS'));
      document.head.appendChild(link);
    });

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => {
        this.leafletLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('No se pudo cargar Leaflet JS'));
      document.body.appendChild(script);
    });
  }

  private initMap() {
    const L: any = (window as any).L;
    if (!L) throw new Error('Leaflet no disponible');

    this.map = L.map('map', {
      center: BV_COORDS,
      zoom: 13,
      zoomControl: true,
      minZoom: 11,
      maxBounds: BV_BOUNDS,
      maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    // marcador de referencia centro Buenaventura
    L.marker(BV_COORDS).addTo(this.map).bindPopup('Buenaventura');
    try { this.map.fitBounds(BV_BOUNDS, { padding: [24, 24] }); } catch {}
  }

  // UI handlers selección
  selectRuta(id: UUID) {
    this.selectedRutaId.set(id);
    const ruta = this.rutas().find(r => r.id === id) || null;
    this.drawSelectedRuta(ruta);
  }

  async selectVehiculo(id: UUID) {
    this.selectedVehiculoId.set(id);
    await this.checkRecorridoActivo();
  }

  // Acciones conductor
  async iniciarRecorrido() {
    if (this.isStarting()) return;
    this.isStarting.set(true);
    const ruta_id = this.selectedRutaId();
    const vehiculo_id = this.selectedVehiculoId();
    const perfil_id = (environment as any).profileId as UUID;
    if (!ruta_id || !vehiculo_id || !perfil_id) { this.isStarting.set(false); return; }
    try {
      let apiRutaId = ruta_id as UUID;
      const sel = this.rutas().find(r => r.id === ruta_id) || null;
      if (sel && sel.source === 'supa') {
        // Si ya tenemos ext_id almacenado, úsalo y evita recrear
        const existingExtId = (sel as any).ext_id as string | null | undefined;
        if (existingExtId) {
          apiRutaId = existingExtId as UUID;
        } else {
          if (!sel.coordenadas || sel.coordenadas.length < 2) { this.isStarting.set(false); return; }
          const shape = { type: 'LineString', coordinates: sel.coordenadas.map(p => [p[1], p[0]]) };
          const creado = await this.reco.crearRuta({ nombre_ruta: sel.nombre, shape });
          apiRutaId = (creado?.id ?? creado?.data?.id ?? creado?.ruta?.id) as UUID;
          if (!apiRutaId) { this.isStarting.set(false); return; }
          // Persistir ext_id en Supabase para no recrear en el futuro
          try {
            await this.admin.updateRuta(String(sel.id), { ext_id: apiRutaId } as any);
          } catch {}
        }
      }

      const res = await this.api.iniciarRecorrido({ ruta_id: apiRutaId, vehiculo_id, perfil_id }).toPromise();
      const recId = (res as any)?.body?.id as UUID | null;
      if (recId) {
        this.currentRecorridoId.set(recId);
        const selRuta = this.rutas().find(r => (r.id === ruta_id) || (r.id === apiRutaId));
        if (selRuta) this.currentRecorridoRutaName.set(selRuta.nombre);
        this.startLiveTracking(recId);
      }
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || '';
      const needsCreate = /selected ruta id is invalid/i.test(msg || '');
      if (!needsCreate) {
        console.error('No se pudo iniciar el recorrido', e);
        this.isStarting.set(false);
        return;
      }
      // Crear ruta en API y reintentar (y guardar ext_id en Supabase)
      try {
        const ruta = this.rutas().find(r => r.id === ruta_id);
        if (!ruta || !ruta.coordenadas || ruta.coordenadas.length < 2) return;
        // convertir a GeoJSON LineString [lng, lat]
        const shape = { type: 'LineString', coordinates: ruta.coordenadas.map(p => [p[1], p[0]]) };
        const creado = await this.reco.crearRuta({ nombre_ruta: ruta.nombre, shape });
        const newId = (creado?.id ?? creado?.data?.id ?? creado?.ruta?.id) as UUID | null;
        if (!newId) return;
        try { await this.admin.updateRuta(String(ruta.id), { ext_id: newId } as any); } catch {}
        const res2 = await this.api.iniciarRecorrido({ ruta_id: newId, vehiculo_id, perfil_id }).toPromise();
        const recId2 = (res2 as any)?.body?.id as UUID | null;
        if (recId2) {
          this.currentRecorridoId.set(recId2);
          const selRuta = this.rutas().find(r => r.id === ruta_id);
          if (selRuta) this.currentRecorridoRutaName.set(selRuta.nombre);
          this.startLiveTracking(recId2);
        }
      } catch (ee) {
        console.error('No se pudo crear la ruta o iniciar el recorrido', ee);
      }
    }
    this.isStarting.set(false);
  }

  async finalizarRecorrido() {
    const recId = this.currentRecorridoId();
    const perfil_id = (environment as any).profileId as UUID;
    if (!recId || !perfil_id) return;
    try {
      await this.api.finalizarRecorrido(recId, perfil_id).toPromise();
      this.currentRecorridoId.set(null);
      this.currentRecorridoRutaName.set(null);
      this.stopLiveTracking();
    } catch (e) {
      console.error('No se pudo finalizar el recorrido', e);
    }
  }

  private startLiveTracking(recorrido_id: UUID) {
    const L: any = (window as any).L;
    if (!('geolocation' in navigator)) return;
    if (this.posWatchId != null) this.stopLiveTracking();
    this.liveCentered = false;
    this.lastPos = null;
    if (!this.meIcon && L) {
      this.meIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#2563eb">
            <circle cx="12" cy="12" r="6" fill="#3b82f6"/>
            <circle cx="12" cy="12" r="10" fill="none" stroke="#93c5fd" stroke-width="2"/>
          </svg>
        `),
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });
    }
    this.posWatchId = navigator.geolocation.watchPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        // solo actualiza última posición; el envío se hace cada 3s por intervalo
        this.lastPos = { lat, lon };
        if (this.map && L) {
          if (this.liveMarker) {
            try { this.liveMarker?.setLatLng([lat, lon]); } catch {}
          } else {
            const opts: any = this.meIcon ? { icon: this.meIcon } : {};
            this.liveMarker = L.marker([lat, lon], opts).addTo(this.map!).bindPopup('Mi posición');
          }
          if (!this.liveCentered) {
            try { this.map?.setView([lat, lon], Math.max(this.map?.getZoom?.() || 13, 16)); } catch {}
            this.liveCentered = true;
          }
        }
      },
      _err => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Enviar a la API cada 3 segundos si hay una última posición disponible
    if (this.posIntervalId != null) {
      try { window.clearInterval(this.posIntervalId); } catch {}
    }
    this.posIntervalId = window.setInterval(async () => {
      if (!this.lastPos) return;
      try {
        const perfil_id = (environment as any).profileId as UUID;
        await this.api.registrarPosicion(recorrido_id, { lat: this.lastPos.lat, lon: this.lastPos.lon, perfil_id }).toPromise();
      } catch {}
    }, 5000);
  }

  private stopLiveTracking() {
    if (this.posWatchId != null) {
      try { navigator.geolocation.clearWatch(this.posWatchId); } catch {}
      this.posWatchId = null;
    }
    if (this.posIntervalId != null) {
      try { window.clearInterval(this.posIntervalId); } catch {}
      this.posIntervalId = null;
    }
    if (this.map && this.liveMarker) {
      try { this.map.removeLayer(this.liveMarker); } catch {}
      this.liveMarker = null;
    }
    this.liveCentered = false;
    this.lastPos = null;
  }

}
