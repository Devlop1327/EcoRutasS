import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
  marca?: string;
  modelo?: string;
  activo?: boolean;
  rutaId?: string;
  lat?: number;
  lng?: number;
};

type Calle = {
  id: string;
  nombre: string;
  coordenadas?: Array<[number, number]>;
};

@Injectable({ providedIn: 'root' })
export class RecoleccionService {
  private http = inject(HttpClient);
  private readonly localRutas: Ruta[] = [
    {
      id: 'ruta-1',
      nombre: 'Ruta centro',
      zona: 'Centro',
      coordenadas: [[-33.4489, -70.6693], [-33.4475, -70.668], [-33.446, -70.6664], [-33.4438, -70.6656]]
    },
    {
      id: 'ruta-2',
      nombre: 'Ruta sur',
      zona: 'Sur',
      coordenadas: [[-33.462, -70.6805], [-33.4589, -70.678], [-33.456, -70.6755], [-33.4522, -70.6738]]
    }
  ];

  private readonly localCalles: Calle[] = [
    { id: 'calle-1', nombre: 'Av. Providencia', coordenadas: [[-33.4489, -70.6693], [-33.4475, -70.668], [-33.446, -70.6664]] },
    { id: 'calle-2', nombre: 'Calle Los Ángeles', coordenadas: [[-33.462, -70.6805], [-33.4589, -70.678], [-33.456, -70.6755]] },
    { id: 'calle-3', nombre: 'Paseo Bulnes', coordenadas: [[-33.4438, -70.6656], [-33.442, -70.6635], [-33.4405, -70.6619]] }
  ];

  private readonly localVehiculos: Vehiculo[] = [];

  private readonly base = this.resolveBase();

  private resolveBase(): string {
    const configured = (environment.recoleccionApiUrl || '').replace(/\/$/, '').trim();
    return configured ? `${configured}/api` : '';
  }

  async getRutas(): Promise<Ruta[]> {
    if (!this.base) return [...this.localRutas];
    try {
      const json = await firstValueFrom(this.http.get<any>(`${this.base}/rutas`, { withCredentials: false }));
      const data = json?.data ?? json;
      return (data || []).map((r: any) => ({
        id: String(r.id ?? r.ext_id ?? r.codigo ?? ''),
        nombre: String(r.nombre ?? r.name ?? r.titulo ?? 'Ruta'),
        zona: r.zona ?? r.zone ?? undefined,
        coordenadas: this.parseCoords(r.coordenadas ?? r.coordinates ?? r.path ?? r.geometry ?? r.shape),
      }));
    } catch {
      return [...this.localRutas];
    }
  }

  async getCalles(): Promise<Calle[]> {
    if (!this.base) return [...this.localCalles];
    try {
      const json = await firstValueFrom(this.http.get<any>(`${this.base}/calles`, { withCredentials: false }));
      const data = json?.data ?? json;
      return (data || []).map((c: any) => ({
        id: String(c.id ?? c.ext_id ?? c.codigo ?? ''),
        nombre: String(c.nombre_calle ?? c.nombre ?? c.name ?? 'Calle'),
        coordenadas: this.parseCoords(c.coordenadas ?? c.coordinates ?? c.path ?? c.geometry ?? c.shape),
      })).filter((c: Calle) => !!c.id && !!c.coordenadas && c.coordenadas.length > 1);
    } catch {
      return [...this.localCalles];
    }
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
    // GeoJSON MultiLineString: [[ [lng,lat], ... ], ... ]
    if (raw.type === 'MultiLineString' && Array.isArray(raw.coordinates)) {
      const flat: Array<[number, number]> = [];
      for (const line of raw.coordinates) {
        if (Array.isArray(line)) {
          for (const c of line) {
            flat.push([Number(c[1]), Number(c[0])]);
          }
        }
      }
      return flat.length ? flat : undefined;
    }
    return undefined;
  }

  async getVehiculos(): Promise<Vehiculo[]> {
    if (!this.base) return [];

    const perfil = environment.profileId;
    let allVehiculos: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      try {
        const json = await firstValueFrom(this.http.get<any>(`${this.base}/vehiculos`, {
          withCredentials: false,
          params: {
            perfil_id: String(perfil),
            page: String(currentPage)
          }
        }));

        const data = json?.data ?? [];

        if (Array.isArray(data) && data.length > 0) {
          allVehiculos = allVehiculos.concat(data);
        }

        const lastPage = json?.last_page ?? 1;
        const nextPageUrl = json?.next_page_url;

        if (currentPage >= lastPage || !nextPageUrl) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      } catch {
        return [...this.localVehiculos];
      }
    }

    return allVehiculos.map((v: any) => ({
      id: String(v.id ?? v.ext_id ?? v.codigo ?? ''),
      placa: v.placa ?? v.plate ?? undefined,
      marca: v.marca ?? v.brand ?? undefined,
      modelo: v.modelo ?? v.model ?? undefined,
      activo: v.activo ?? v.active ?? true,
      rutaId: v.ruta_id ?? v.route_ext_id ?? undefined,
      lat: v.lat ?? v.latitude ?? v.latitud ?? undefined,
      lng: v.lng ?? v.longitude ?? v.longitud ?? undefined,
    }));
  }

  async crearVehiculo(payload: { placa: string; marca: string; modelo: string; activo: boolean }): Promise<any> {
    if (!this.base) {
      return { ok: true, data: { ...payload, id: `veh-${Date.now()}` } };
    }
    const body = { ...payload, perfil_id: environment.profileId };
    return await firstValueFrom(this.http.post(`${this.base}/vehiculos`, body));
  }

  async crearRuta(payload: { nombre_ruta: string; shape?: any; calles_ids?: string[] }): Promise<any> {
    if (!this.base) {
      return { ok: true, data: { id: `ruta-${Date.now()}`, nombre_ruta: payload.nombre_ruta } };
    }
    const body: any = { nombre_ruta: payload.nombre_ruta, perfil_id: environment.profileId };
    if (payload.shape) body.shape = payload.shape;
    if (payload.calles_ids) body.calles_ids = payload.calles_ids;
    return await firstValueFrom(this.http.post(`${this.base}/rutas`, body));
  }

  async iniciarRecorrido(payload: { ruta_id: string; vehiculo_id: string }): Promise<any> {
    if (!this.base) {
      return { ok: true, data: { id: `recorrido-${Date.now()}`, ...payload } };
    }
    const body = { ...payload, perfil_id: environment.profileId };
    return await firstValueFrom(this.http.post(`${this.base}/recorridos/iniciar`, body));
  }

  async registrarPosicion(recorrido_id: string, payload: { lat: number; lon: number }): Promise<any> {
    if (!this.base) {
      return { ok: true, data: { recorrido_id: recorrido_id, ...payload } };
    }
    const body = { ...payload, perfil_id: environment.profileId };
    return await firstValueFrom(this.http.post(`${this.base}/recorridos/${recorrido_id}/posiciones`, body));
  }

  async getRutaById(id: string): Promise<any> {
    if (!this.base) {
      return this.localRutas.find((ruta) => ruta.id === id) ?? null;
    }
    return await firstValueFrom(this.http.get(`${this.base}/rutas/${id}`, { withCredentials: false }));
  }

  async getVehiculoById(id: string): Promise<any> {
    if (!this.base) {
      return this.localVehiculos.find((vehiculo) => vehiculo.id === id) ?? null;
    }
    const perfil = environment.profileId;
    return await firstValueFrom(this.http.get(`${this.base}/vehiculos/${id}`, {
      withCredentials: false,
      params: { perfil_id: String(perfil) }
    }));
  }

  async updateVehiculo(id: string, payload: { placa?: string; marca?: string; modelo?: string; activo?: boolean }): Promise<any> {
    if (!this.base) {
      const current = this.localVehiculos.find((vehiculo) => vehiculo.id === id);
      return { ok: true, data: { ...current, ...payload } };
    }
    return await firstValueFrom(this.http.put(`${this.base}/vehiculos/${id}`, { ...payload, perfil_id: environment.profileId }));
  }

  async deleteVehiculo(id: string): Promise<any> {
    if (!this.base) {
      return { ok: true, data: { deletedId: id } };
    }
    try {
      return await firstValueFrom(this.http.delete(`${this.base}/vehiculos/${id}`, {
        body: { perfil_id: environment.profileId },
        headers: { 'Content-Type': 'application/json' }
      }));
    } catch (error: any) {
      console.error(`Error al borrar vehículo ${id}:`, error?.error?.error || error?.error?.message || error?.message);
      throw error;
    }
  }

  async listarPosiciones(recorrido_id: string): Promise<any[]> {
    if (!this.base) {
      return [{ recorrido_id: recorrido_id, lat: -33.4482, lng: -70.6684 }];
    }
    const res = await firstValueFrom(this.http.get<any>(`${this.base}/recorridos/${recorrido_id}/posiciones`, { withCredentials: false }));
    return res?.data ?? res ?? [];
  }

  async misRecorridos(): Promise<any[]> {
    if (!this.base) {
      return [{ id: 'recorrido-1', nombre: 'Recorrido local', estado: 'activo' }];
    }
    const res = await firstValueFrom(this.http.get<any>(`${this.base}/misrecorridos`, { withCredentials: false }));
    return res?.data ?? res ?? [];
  }

  async finalizarRecorrido(recorrido_id: string): Promise<any> {
    if (!this.base) {
      return { ok: true, data: { recorrido_id: recorrido_id, estado: 'finalizado' } };
    }
    return await firstValueFrom(this.http.post(`${this.base}/recorridos/${recorrido_id}/finalizar`, { perfil_id: environment.profileId }));
  }
}
