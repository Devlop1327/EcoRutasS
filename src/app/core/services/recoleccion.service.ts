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

@Injectable({ providedIn: 'root' })
export class RecoleccionService {
  private http = inject(HttpClient);
  // En desarrollo usamos proxy para evitar CORS. Si no existe, cae al dominio directo.
  private base = (environment.recoleccionApiProxy || environment.recoleccionApiUrl) + '/api';

  async getRutas(): Promise<Ruta[]> {
    const json = await firstValueFrom(this.http.get<any>(`${this.base}/rutas`, { withCredentials: false }));
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
    const json = await firstValueFrom(this.http.get<any>(`${this.base}/vehiculos`, { withCredentials: false }));
    const data = json?.data ?? json;
    return (data || []).map((v: any) => ({
      id: String(v.id ?? v.ext_id ?? v.codigo ?? ''),
      placa: v.placa ?? v.plate ?? undefined,
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
    return await firstValueFrom(this.http.get(`${this.base}/vehiculos/${id}`, { withCredentials: false }));
  }

  async updateVehiculo(id: string, payload: { placa?: string; marca?: string; modelo?: string; activo?: boolean }): Promise<any> {
    return await firstValueFrom(this.http.put(`${this.base}/vehiculos/${id}`, { ...payload, perfil_id: environment.profileId }));
  }

  async deleteVehiculo(id: string): Promise<any> {
    return await firstValueFrom(this.http.delete(`${this.base}/vehiculos/${id}`));
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
