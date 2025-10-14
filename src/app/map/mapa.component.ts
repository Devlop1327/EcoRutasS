import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecoleccionService } from '../core/services/recoleccion.service';

// Coordenadas aproximadas de Buenaventura, Colombia
const BV_COORDS: [number, number] = [3.882, -77.031];

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss']
})
export class MapaComponent implements OnInit, OnDestroy {
  private reco = inject(RecoleccionService);

  loading = signal(true);
  error = signal<string | null>(null);
  rutas = signal<Array<{ id: string; nombre: string; coordenadas?: Array<[number, number]> }>>([]);
  vehiculos = signal<Array<{ id: string; placa?: string; lat?: number; lng?: number }>>([]);

  private leafletLoaded = false;
  private map: any | null = null;

  async ngOnInit() {
    try {
      await this.loadLeafletFromCdn();
      this.initMap();
      await Promise.all([this.loadRutas(), this.loadVehiculos()]);
      this.drawRutas();
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
  }

  private async loadRutas() {
    try {
      const rutas = await this.reco.getRutas();
      this.rutas.set(rutas);
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

  private drawRutas() {
    const L: any = (window as any).L;
    if (!L || !this.map) return;

    for (const ruta of this.rutas()) {
      if (ruta.coordenadas && ruta.coordenadas.length > 1) {
        L.polyline(ruta.coordenadas, {
          color: '#059669',
          weight: 3,
          opacity: 0.7
        }).addTo(this.map).bindPopup(ruta.nombre);
      }
    }
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
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    // marcador de referencia centro Buenaventura
    L.marker(BV_COORDS).addTo(this.map).bindPopup('Buenaventura');
  }
}
