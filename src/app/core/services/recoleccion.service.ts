import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

type Ruta = {
  id: string;
  nombre: string;
  zona?: string;
  coordenadas?: Array<[number, number]>; // [lat, lng][]
};

type Vehiculo = {
  id: string;
  placa?: string;
  rutaId?: string;
  lat?: number;
  lng?: number;
};

@Injectable({ providedIn: 'root' })
export class RecoleccionService {
  private base = environment.recoleccionApiUrl;

  async getRutas(): Promise<Ruta[]> {
    const res = await fetch(`${this.base}/rutas`, { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudieron cargar las rutas');
    const json = await res.json();
    const data = json?.data ?? json; // normaliza response.data
    return (data || []).map((r: any) => ({
      id: String(r.id ?? r.ext_id ?? r.codigo ?? ''),
      nombre: String(r.nombre ?? r.name ?? r.titulo ?? 'Ruta'),
      zona: r.zona ?? r.zone ?? undefined,
      coordenadas: this.parseCoords(r.coordenadas ?? r.coordinates ?? r.path ?? r.geometry),
    }));
  }

  private parseCoords(raw: any): Array<[number, number]> | undefined {
    if (!raw) return undefined;
    // Si es string GeoJSON o array, intenta parsear
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    // Si es array de [lat, lng] o [[lat, lng], ...]
    if (Array.isArray(raw)) {
      if (raw.length === 0) return undefined;
      // Si primer elemento es array: [[lat,lng],...]
      if (Array.isArray(raw[0])) {
        return raw.map((p: any) => [Number(p[0] ?? p.lat ?? 0), Number(p[1] ?? p.lng ?? 0)]);
      }
      // Si es [lat, lng] único
      if (typeof raw[0] === 'number') return [[Number(raw[0]), Number(raw[1])]];
    }
    // GeoJSON LineString
    if (raw.type === 'LineString' && Array.isArray(raw.coordinates)) {
      return raw.coordinates.map((c: any) => [Number(c[1]), Number(c[0])]); // GeoJSON es [lng, lat]
    }
    return undefined;
  }

  async getVehiculos(): Promise<Vehiculo[]> {
    const res = await fetch(`${this.base}/vehiculos`, { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudieron cargar los vehículos');
    const json = await res.json();
    const data = json?.data ?? json;
    return (data || []).map((v: any) => ({
      id: String(v.id ?? v.ext_id ?? v.codigo ?? ''),
      placa: v.placa ?? v.plate ?? undefined,
      rutaId: v.ruta_id ?? v.route_ext_id ?? undefined,
      lat: v.lat ?? v.latitude ?? v.latitud ?? undefined,
      lng: v.lng ?? v.longitude ?? v.longitud ?? undefined,
    }));
  }
}
