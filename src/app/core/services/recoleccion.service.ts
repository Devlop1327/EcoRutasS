import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  // En desarrollo (localhost) usamos proxy para evitar CORS; en otros hosts usamos URL absoluta
  private base = ((
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) && environment.recoleccionApiProxy
    ? environment.recoleccionApiProxy
    : environment.recoleccionApiUrl) + '/api';

  async getRutas(): Promise<Ruta[]> {
    const json = await firstValueFrom(this.http.get<any>(`${this.base}/rutas`, { withCredentials: false }));
    const data = json?.data ?? json; // normaliza response.data
    return (data || []).map((r: any) => ({
      id: String(r.id ?? r.ext_id ?? r.codigo ?? ''),
      nombre: String(r.nombre ?? r.name ?? r.titulo ?? 'Ruta'),
      zona: r.zona ?? r.zone ?? undefined,
      coordenadas: this.parseCoords(r.coordenadas ?? r.coordinates ?? r.path ?? r.geometry ?? r.shape),
    }));
  }

  async getCalles(): Promise<Calle[]> {
    const json = await firstValueFrom(this.http.get<any>(`${this.base}/calles`, { withCredentials: false }));
    const data = json?.data ?? json;
    return (data || []).map((c: any) => ({
      id: String(c.id ?? c.ext_id ?? c.codigo ?? ''),
      nombre: String(c.nombre_calle ?? c.nombre ?? c.name ?? 'Calle'),
      coordenadas: this.parseCoords(c.coordenadas ?? c.coordinates ?? c.path ?? c.geometry ?? c.shape),
    })).filter((c: Calle) => !!c.id && !!c.coordenadas && c.coordenadas.length > 1);
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
    const perfil = environment.profileId;
    let allVehiculos: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;


    // Cargar TODAS las páginas
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

        // Agregar vehículos de esta página
        if (Array.isArray(data) && data.length > 0) {
          allVehiculos = allVehiculos.concat(data);
        }

        // Verificar si hay más páginas
        const lastPage = json?.last_page ?? 1;
        const nextPageUrl = json?.next_page_url;

        if (currentPage >= lastPage || !nextPageUrl) {
          hasMorePages = false;
        } else {
          currentPage++;
        }

      } catch (error) {
        hasMorePages = false;
      }
    }

    // Mapear todos los vehículos al formato esperado
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

  // POST /api/vehiculos
  async crearVehiculo(payload: { placa: string; marca: string; modelo: string; activo: boolean }): Promise<any> {
    const body = { ...payload, perfil_id: environment.profileId };
    return await firstValueFrom(this.http.post(`${this.base}/vehiculos`, body));
  }

  // POST /api/rutas (caso A o B según docs)
  async crearRuta(payload: { nombre_ruta: string; shape?: any; calles_ids?: string[] }): Promise<any> {
    const body: any = { nombre_ruta: payload.nombre_ruta, perfil_id: environment.profileId };
    if (payload.shape) body.shape = payload.shape;
    if (payload.calles_ids) body.calles_ids = payload.calles_ids;
    return await firstValueFrom(this.http.post(`${this.base}/rutas`, body));
  }

  // POST /api/recorridos/iniciar
  async iniciarRecorrido(payload: { ruta_id: string; vehiculo_id: string }): Promise<any> {
    const body = { ...payload, perfil_id: environment.profileId };
    return await firstValueFrom(this.http.post(`${this.base}/recorridos/iniciar`, body));
  }

  // POST /api/recorridos/{recorrido_id}/posiciones
  async registrarPosicion(recorrido_id: string, payload: { lat: number; lon: number }): Promise<any> {
    const body = { ...payload, perfil_id: environment.profileId };
    return await firstValueFrom(this.http.post(`${this.base}/recorridos/${recorrido_id}/posiciones`, body));
  }

  async getRutaById(id: string): Promise<any> {
    return await firstValueFrom(this.http.get(`${this.base}/rutas/${id}`, { withCredentials: false }));
  }

  async getVehiculoById(id: string): Promise<any> {
    const perfil = environment.profileId;
    return await firstValueFrom(this.http.get(`${this.base}/vehiculos/${id}`, {
      withCredentials: false,
      params: { perfil_id: String(perfil) }
    }));
  }

  async updateVehiculo(id: string, payload: { placa?: string; marca?: string; modelo?: string; activo?: boolean }): Promise<any> {
    return await firstValueFrom(this.http.put(`${this.base}/vehiculos/${id}`, { ...payload, perfil_id: environment.profileId }));
  }

  async deleteVehiculo(id: string): Promise<any> {
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
    const res = await firstValueFrom(this.http.get<any>(`${this.base}/recorridos/${recorrido_id}/posiciones`, { withCredentials: false }));
    return res?.data ?? res ?? [];
  }

  async misRecorridos(): Promise<any[]> {
    const res = await firstValueFrom(this.http.get<any>(`${this.base}/misrecorridos`, { withCredentials: false }));
    return res?.data ?? res ?? [];
  }

  async finalizarRecorrido(recorrido_id: string): Promise<any> {
    return await firstValueFrom(this.http.post(`${this.base}/recorridos/${recorrido_id}/finalizar`, { perfil_id: environment.profileId }));
  }
}
