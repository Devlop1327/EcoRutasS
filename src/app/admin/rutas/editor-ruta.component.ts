import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RecoleccionService } from '../../core/services/recoleccion.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-editor-ruta',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule
  ],
  templateUrl: './editor-ruta.component.html',
  styleUrls: ['./editor-ruta.component.scss']
})
export class EditorRutaComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reco = inject(RecoleccionService);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre_ruta: ['', [Validators.required]]
  });

  private map: any;
  private layerGroup: any;
  puntos = signal<Array<[number, number]>>([]); // [lat, lng]

  async ngOnInit() {
    this.initMap();
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) {
      try {
        const data: any = await this.reco.getRutaById(id);
        const coords = this.extractCoords(data?.coordenadas || data?.geometry || data?.shape || data?.coordinates);
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
    const L: any = (window as any).L;
    if (!L) return;
    this.map = L.map('editor-map', { center: [3.8801, -77.0283], zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.map);
    this.layerGroup = L.layerGroup().addTo(this.map);
    this.map.on('click', (e: any) => {
      const lat = Number(e.latlng?.lat);
      const lng = Number(e.latlng?.lng);
      this.puntos.update(arr => [...arr, [lat, lng]]);
      this.draw();
    });
  }

  private draw() {
    if (!this.layerGroup) return;
    const L: any = (window as any).L;
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
      await this.reco.crearRuta(body);
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
