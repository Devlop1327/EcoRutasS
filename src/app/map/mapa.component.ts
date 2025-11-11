import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecoleccionService } from '../core/services/recoleccion.service';
import { RouterModule } from '@angular/router';
import { ApiService, type UUID } from '../services/api.service';
import { ConductorOnlyDirective } from '../core/directives/conductor-only.directive';
import { environment } from '../../environments/environment';
import { AdminDataService } from '../core/services/admin-data.service';

// Coordenadas aproximadas de Buenaventura, Colombia
const BV_COORDS: [number, number] = [3.8833, -77.0283];
const BV_BOUNDS: [[number, number], [number, number]] = [
  [3.84, -77.08],
  [3.92, -76.98]
];

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, RouterModule, ConductorOnlyDirective],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss']
})
export class MapaComponent implements OnInit, OnDestroy {
  private reco = inject(RecoleccionService);
  private api = inject(ApiService);
  private admin = inject(AdminDataService);

  loading = signal(true);
  error = signal<string | null>(null);
  rutas = signal<Array<{ id: string; nombre: string; coordenadas?: Array<[number, number]> }>>([]);
  vehiculos = signal<Array<{ id: string; placa?: string; lat?: number; lng?: number }>>([]);

  // Selección para iniciar/finalizar (solo conductor)
  selectedRutaId = signal<UUID | null>(null);
  selectedVehiculoId = signal<UUID | null>(null);
  currentRecorridoId = signal<UUID | null>(null);
  isStarting = signal(false);

  private leafletLoaded = false;
  private map: any | null = null;
  private selectedRutaLayer: any | null = null;
  private liveMarker: any | null = null;
  private posWatchId: number | null = null;
  // Simulación
  private simMarker: any | null = null;
  private simTimerId: number | null = null;
  private simIdx = 0;

  async ngOnInit() {
    try {
      await this.loadLeafletFromCdn();
      this.initMap();
      await Promise.all([this.loadRutas(), this.loadVehiculos()]);
      // No dibujar todas las rutas; solo cuando el usuario seleccione
      this.drawVehiculos();
    } catch (e: any) {
      this.error.set(e?.message || 'Error cargando el mapa');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.map && this.map.remove) {
      this.map.remove();
      this.map = null;
    }
    this.stopLiveTracking();
  }

  private async loadRutas() {
    try {
      // Preferir nombres y geometrías desde Supabase
      const supa = await this.admin.listRutas();
      const mapped = (supa || []).map(r => ({
        id: String(r.id || ''),
        nombre: String(r.nombre || 'Ruta'),
        coordenadas: r.coordenadas || (r.geometria?.type === 'LineString' && Array.isArray(r.geometria.coordinates)
          ? r.geometria.coordinates.map((c: any) => [Number(c[1]), Number(c[0])])
          : undefined)
      })).filter(r => !!r.id);
      // Si Supabase está vacío, caer a la API pública
      if (!mapped.length) {
        const rutasPublic = await this.reco.getRutas();
        this.rutas.set(rutasPublic);
      } else {
        this.rutas.set(mapped);
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
      zoom: 14,
      minZoom: 13,
      maxZoom: 18,
      zoomControl: true,
      dragging: true,
      scrollWheelZoom: 'center',
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      touchZoom: true,
      maxBounds: BV_BOUNDS,
      maxBoundsViscosity: 0.8
    });

    try {
      this.map.setView(BV_COORDS, 14, { animate: false });
    } catch {}

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 13,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    // marcador de referencia centro Buenaventura
    L.marker(BV_COORDS).addTo(this.map).bindPopup('Buenaventura');
  }

  // UI handlers selección
  selectRuta(id: UUID) {
    this.selectedRutaId.set(id);
    const ruta = this.rutas().find(r => r.id === id) || null;
    this.drawSelectedRuta(ruta);
  }

  selectVehiculo(id: UUID) {
    this.selectedVehiculoId.set(id);
  }

  // Acciones conductor
  async iniciarRecorrido() {
    if (this.isStarting()) return;
    this.isStarting.set(true);
    const ruta_id = this.selectedRutaId();
    const vehiculo_id = this.selectedVehiculoId();
    const perfil_id = (environment as any).profileId as UUID;
    if (!ruta_id || !vehiculo_id || !perfil_id) return;
    try {
      const res = await this.api.iniciarRecorrido({ ruta_id, vehiculo_id, perfil_id }).toPromise();
      // Asumimos que la API devuelve el id del recorrido creado en body.id (ajustar si difiere)
      const recId = (res as any)?.body?.id as UUID | null;
      if (recId) {
        this.currentRecorridoId.set(recId);
        this.startSimulatedRun(recId);
      }
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || '';
      const needsCreate = /selected ruta id is invalid/i.test(msg || '');
      if (!needsCreate) {
        console.error('No se pudo iniciar el recorrido', e);
        this.isStarting.set(false);
        return;
      }
      // Crear ruta en API y reintentar
      try {
        const ruta = this.rutas().find(r => r.id === ruta_id);
        if (!ruta || !ruta.coordenadas || ruta.coordenadas.length < 2) return;
        // convertir a GeoJSON LineString [lng, lat]
        const shape = { type: 'LineString', coordinates: ruta.coordenadas.map(p => [p[1], p[0]]) };
        const creado = await this.reco.crearRuta({ nombre_ruta: ruta.nombre, shape });
        const newId = (creado?.id ?? creado?.data?.id ?? creado?.ruta?.id) as UUID | null;
        if (!newId) return;
        const res2 = await this.api.iniciarRecorrido({ ruta_id: newId, vehiculo_id, perfil_id }).toPromise();
        const recId2 = (res2 as any)?.body?.id as UUID | null;
        if (recId2) {
          this.currentRecorridoId.set(recId2);
          this.startSimulatedRun(recId2);
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
      this.stopLiveTracking();
      this.stopSimulatedRun();
    } catch (e) {
      console.error('No se pudo finalizar el recorrido', e);
    }
  }

  private startLiveTracking(recorrido_id: UUID) {
    const L: any = (window as any).L;
    if (!('geolocation' in navigator)) return;
    if (this.posWatchId != null) this.stopLiveTracking();
    this.posWatchId = navigator.geolocation.watchPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const perfil_id = (environment as any).profileId as UUID;
          await this.api.registrarPosicion(recorrido_id, { lat, lon, perfil_id }).toPromise();
        } catch {}
        if (this.map && L) {
          if (this.liveMarker) {
            try { this.liveMarker.setLatLng([lat, lon]); } catch {}
          } else {
            this.liveMarker = L.marker([lat, lon]).addTo(this.map).bindPopup('Mi posición');
          }
        }
      },
      _err => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  private stopLiveTracking() {
    if (this.posWatchId != null) {
      try { navigator.geolocation.clearWatch(this.posWatchId); } catch {}
      this.posWatchId = null;
    }
    if (this.map && this.liveMarker) {
      try { this.map.removeLayer(this.liveMarker); } catch {}
      this.liveMarker = null;
    }
  }

  // Simulación de movimiento sobre la ruta seleccionada
  private startSimulatedRun(recorrido_id: UUID) {
    const L: any = (window as any).L;
    const ruta = this.rutas().find(r => r.id === this.selectedRutaId());
    if (!this.map || !L || !ruta || !ruta.coordenadas || ruta.coordenadas.length < 2) return;
    this.stopSimulatedRun();
    this.simIdx = 0;
    const points = ruta.coordenadas.slice(); // [lat,lng]
    this.simMarker = L.circleMarker(points[0], { radius: 6, color: '#2563eb', weight: 3, fillColor: '#60a5fa', fillOpacity: 0.9 })
      .addTo(this.map)
      .bindPopup('Seguimiento');

    const perfil_id = (environment as any).profileId as UUID;
    const stepMs = 5000; // 1 seg por punto

    this.simTimerId = window.setInterval(async () => {
      this.simIdx = (this.simIdx + 1) % points.length;
      const [lat, lng] = points[this.simIdx];
      try { this.simMarker.setLatLng([lat, lng]); } catch {}
      try {
        await this.api.registrarPosicion(recorrido_id, { lat, lon: lng, perfil_id }).toPromise();
      } catch {}
    }, stepMs);
  }

  private stopSimulatedRun() {
    if (this.simTimerId != null) {
      try { window.clearInterval(this.simTimerId); } catch {}
      this.simTimerId = null;
    }
    if (this.map && this.simMarker) {
      try { this.map.removeLayer(this.simMarker); } catch {}
      this.simMarker = null;
    }
  }
}
