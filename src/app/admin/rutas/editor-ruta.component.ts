import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RecoleccionService } from '../../core/services/recoleccion.service';
import * as L from 'leaflet';
import 'leaflet-draw';
import { AdminDataService } from '../../core/services/admin-data.service';

@Component({
  selector: 'app-editor-ruta',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './editor-ruta.component.html',
  styleUrls: ['./editor-ruta.component.scss']
})
export class EditorRutaComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reco = inject(RecoleccionService);
  private admin = inject(AdminDataService);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre_ruta: ['', [Validators.required]]
  });

  private map: any;
  private layerGroup: any;
  private drawnItems: any;
  puntos = signal<Array<[number, number]>>([]); // [lat, lng]

  async ngOnInit() {
    this.initMap();
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) {
      try {
        // Primero intenta desde Supabase
        const supa = await this.admin.getRuta(id);
        const data: any = supa ?? await this.reco.getRutaById(id).catch(() => null);
        const coords = this.extractCoords(
          data?.coordenadas || data?.geometria || data?.geometry || data?.shape || data?.coordinates
        );
        if (coords && coords.length) {
          this.puntos.set(coords);
          this.draw();
          this.fitBounds();
        }
        if (data?.nombre) this.form.controls.nombre_ruta.setValue(String(data.nombre));
      } catch {
        // ignore
      }
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }
  }

  private initMap() {
    const BV_COORDS: [number, number] = [3.882, -77.031];
    const BV_BOUNDS: [[number, number], [number, number]] = [[3.70, -77.25], [4.05, -76.85]];
    this.map = L.map('editor-map', {
      center: BV_COORDS,
      zoom: 13,
      minZoom: 11,
      maxBounds: BV_BOUNDS as any,
      maxBoundsViscosity: 1.0
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.map);
    this.layerGroup = L.layerGroup().addTo(this.map);
    this.drawnItems = new L.FeatureGroup();
    this.map.addLayer(this.drawnItems);

    const drawControl = new (L as any).Control.Draw({
      draw: {
        polygon: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
        polyline: { shapeOptions: { color: '#059669', weight: 3 } }
      },
      edit: { featureGroup: this.drawnItems, remove: true }
    });
    this.map.addControl(drawControl);
    try { this.map.fitBounds(BV_BOUNDS as any, { padding: [24, 24] } as any); } catch {}

    this.map.on((L as any).Draw.Event.CREATED, (e: any) => {
      this.drawnItems.clearLayers();
      const layer = e.layer;
      this.drawnItems.addLayer(layer);
      const latlngs = layer.getLatLngs().map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
      this.puntos.set(latlngs);
      this.draw();
      this.fitBounds();
    });

    this.map.on((L as any).Draw.Event.EDITED, () => {
      const layers = this.drawnItems.getLayers();
      if (layers.length) {
        const layer: any = layers[0];
        const latlngs = layer.getLatLngs().map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
        this.puntos.set(latlngs);
        this.draw();
      }
    });

    this.map.on((L as any).Draw.Event.DELETED, () => {
      this.puntos.set([]);
      this.draw();
    });
  }

  private draw() {
    if (!this.layerGroup) return;
    this.layerGroup.clearLayers();
    const pts = this.puntos();
    for (const p of pts) {
      L.circleMarker(p, { radius: 4, color: '#059669' }).addTo(this.layerGroup);
    }
    if (pts.length > 1) {
      L.polyline(pts, { color: '#059669', weight: 3 }).addTo(this.layerGroup);
    }
  }

  private fitBounds() {
    const L: any = (window as any).L;
    if (!this.map || !L) return;
    const pts = this.puntos();
    if (!pts.length) return;
    const bounds = L.latLngBounds(pts.map(p => ({ lat: p[0], lng: p[1] })));
    this.map.fitBounds(bounds.pad(0.2));
  }

  undo() {
    this.puntos.update(arr => arr.slice(0, -1));
    this.draw();
  }

  clearAll() {
    this.puntos.set([]);
    this.draw();
  }

  async save() {
    if (this.loading() || this.form.invalid || this.puntos().length < 2) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      // GeoJSON exige [lng, lat]
      const coordinates = this.puntos().map(p => [p[1], p[0]]);
      const body = {
        nombre_ruta: this.form.controls.nombre_ruta.value,
        shape: { type: 'LineString', coordinates }
      };
      const id = this.route.snapshot.queryParamMap.get('id');
      if (!id) {
        // Nueva: crear en API y en Supabase
        await this.reco.crearRuta(body);
        await this.admin.createRuta({
          nombre: String(this.form.controls.nombre_ruta.value || 'Ruta'),
          geometria: { type: 'LineString', coordinates },
          coordenadas: this.puntos()
        });
      } else {
        // Edición: actualizar en Supabase
        await this.admin.updateRuta(id, {
          nombre: String(this.form.controls.nombre_ruta.value || 'Ruta'),
          geometria: { type: 'LineString', coordinates },
          coordenadas: this.puntos()
        });
      }
      this.success.set('Ruta guardada');
      setTimeout(() => this.router.navigateByUrl('/admin/rutas'), 800);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo guardar la ruta');
    } finally {
      this.loading.set(false);
    }
  }

  private extractCoords(raw: any): Array<[number, number]> | null {
    try {
      if (!raw) return null;
      if (typeof raw === 'string') raw = JSON.parse(raw);
      // Si ya viene como [[lat,lng], ...]
      if (Array.isArray(raw) && Array.isArray(raw[0])) {
        return raw as Array<[number, number]>;
      }
      // GeoJSON LineString
      if (raw?.type === 'LineString' && Array.isArray(raw.coordinates)) {
        return raw.coordinates.map((c: any) => [Number(c[1]), Number(c[0])]);
      }
    } catch {
      return null;
    }
    return null;
  }
}
