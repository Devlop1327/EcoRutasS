import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import * as L from 'leaflet';
import 'leaflet-draw';
import { AdminDataService } from '../../core/services/admin-data.service';

@Component({
  selector: 'app-calles',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './calles.component.html',
  styleUrls: ['./calles.component.scss']
})
export class CallesComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private admin = inject(AdminDataService);

  loading = signal(false);
  listLoading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  calles = signal<Array<any>>([]);
  editingId = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required]]
  });

  private map?: L.Map;
  private drawnItems?: L.FeatureGroup;
  private layerGroup?: L.LayerGroup;
  puntos = signal<Array<[number, number]>>([]);

  ngOnInit(): void {
    this.initMap();
    this.loadCalles();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }
  }

  private initMap() {
    this.map = L.map('calles-map', { center: [3.8801, -77.0283], zoom: 13 });
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
        polyline: { shapeOptions: { color: '#2563eb', weight: 3 } }
      },
      edit: { featureGroup: this.drawnItems, remove: true }
    });
    this.map.addControl(drawControl);

    this.map.on((L as any).Draw.Event.CREATED, (e: any) => {
      this.drawnItems!.clearLayers();
      const layer = e.layer;
      this.drawnItems!.addLayer(layer);
      const latlngs = layer.getLatLngs().map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
      this.puntos.set(latlngs);
      this.draw();
    });

    this.map.on((L as any).Draw.Event.EDITED, () => {
      const layers = this.drawnItems!.getLayers();
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
      L.circleMarker(p, { radius: 4, color: '#2563eb' }).addTo(this.layerGroup);
    }
    if (pts.length > 1) {
      L.polyline(pts, { color: '#2563eb', weight: 3 }).addTo(this.layerGroup);
    }
  }

  async save() {
    if (this.loading() || this.form.invalid || this.puntos().length < 2) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const coordsLatLng = this.puntos();
      const geojson = { type: 'LineString', coordinates: coordsLatLng.map(p => [p[1], p[0]]) };
      const id = this.editingId();
      if (id) {
        await this.admin.updateCalle(id, {
          nombre: this.form.controls.nombre.value,
          geometria: geojson,
          coordenadas: coordsLatLng
        });
        this.success.set('Calle actualizada');
      } else {
        await this.admin.createCalle({
          nombre: this.form.controls.nombre.value,
          geometria: geojson,
          coordenadas: coordsLatLng
        });
        this.success.set('Calle guardada');
      }
      await this.loadCalles();
      this.newCalle();
    } catch (e: any) {
      this.error.set(e?.message || 'No se pudo guardar la calle');
    } finally {
      this.loading.set(false);
    }
  }

  async loadCalles() {
    this.listLoading.set(true);
    this.error.set(null);
    try {
      const data = await this.admin.listCalles();
      this.calles.set(data);
    } catch (e: any) {
      this.error.set('No se pudieron cargar las calles');
    } finally {
      this.listLoading.set(false);
    }
  }

  newCalle() {
    this.editingId.set(null);
    this.form.reset({ nombre: '' });
    this.puntos.set([]);
    this.draw();
  }

  edit(calle: any) {
    this.editingId.set(calle.id);
    const coords = this.extractCoords(calle?.coordenadas || calle?.geometria || calle?.geometry);
    this.form.controls.nombre.setValue(String(calle?.nombre || ''));
    if (coords && coords.length) {
      this.puntos.set(coords);
      this.draw();
      // Dibujar en drawnItems y ajustar bounds
      this.drawnItems!.clearLayers();
      const poly = L.polyline(coords, { color: '#2563eb', weight: 3 });
      this.drawnItems!.addLayer(poly);
      try {
        const bounds = (L as any).latLngBounds(coords.map((p: any) => ({ lat: p[0], lng: p[1] })));
        this.map!.fitBounds(bounds.pad(0.2));
      } catch {}
    }
  }

  async eliminar(id: string) {
    if (!id) return;
    const ok = window.confirm('¿Eliminar esta calle? Esta acción no se puede deshacer.');
    if (!ok) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.admin.deleteCalle(id);
      await this.loadCalles();
      this.newCalle();
    } catch (e: any) {
      this.error.set(e?.message || 'No se pudo eliminar la calle');
    } finally {
      this.loading.set(false);
    }
  }

  private extractCoords(raw: any): Array<[number, number]> | null {
    try {
      if (!raw) return null;
      if (typeof raw === 'string') raw = JSON.parse(raw);
      if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) return raw as Array<[number, number]>;
      if (raw?.type === 'LineString' && Array.isArray(raw.coordinates)) {
        return raw.coordinates.map((c: any) => [Number(c[1]), Number(c[0])]);
      }
    } catch {
      return null;
    }
    return null;
  }
}
