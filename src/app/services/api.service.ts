import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

// Tipos
export type UUID = string;

export interface VehiculoCreate {
  placa: string;
  marca: string;
  modelo: string;
  activo: boolean;
  perfil_id: UUID;
}

export interface RutaShapeGeoJSON {
  type: 'LineString';
  coordinates: [number, number][]; // [lon, lat]
}

export interface RutaCreateCalles {
  nombre_ruta: string;
  perfil_id: UUID;
  calles_ids: UUID[];
  shape?: never;
}

export interface RutaCreateShape {
  nombre_ruta: string;
  perfil_id: UUID;
  shape: RutaShapeGeoJSON;
  calles_ids?: never;
}

export type RutaCreate = RutaCreateCalles | RutaCreateShape;

export interface RecorridoIniciar {
  ruta_id: UUID;
  vehiculo_id: UUID;
  perfil_id: UUID;
}

export interface PosicionCreate {
  lat: number;
  lon: number;
  perfil_id: UUID;
}

export interface RecorridoFinalizarBody {
  perfil_id: UUID;
}

function baseUrl(): string {
  const api = (environment as any).recoleccionApiUrl?.replace(/\/$/, '') || '';
  const proxy = (environment as any).recoleccionApiProxy || '/recoleccion';
  // Usa proxy SOLO en desarrollo
  if (!environment.production && proxy) return `${proxy}/api`;
  return `${api}/api`;
}

function defaultHeaders() {
  return new HttpHeaders()
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json');
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private API = baseUrl();

  // 1) Vehículos
  postVehiculo(body: VehiculoCreate) {
    return this.http.post(`${this.API}/vehiculos`, body, {
      headers: defaultHeaders(),
      observe: 'response'
    });
  }

  // 2) Rutas
  postRuta(body: RutaCreate) {
    return this.http.post(`${this.API}/rutas`, body, {
      headers: defaultHeaders(),
      observe: 'response'
    });
  }

  // 3.1) Iniciar recorrido
  iniciarRecorrido(body: RecorridoIniciar) {
    return this.http.post(`${this.API}/recorridos/iniciar`, body, {
      headers: defaultHeaders(),
      observe: 'response'
    });
  }

  // 3.2) Registrar posición
  registrarPosicion(recorrido_id: UUID, body: PosicionCreate) {
    return this.http.post(`${this.API}/recorridos/${recorrido_id}/posiciones`, body, {
      headers: defaultHeaders(),
      observe: 'response'
    });
  }

  finalizarRecorrido(recorrido_id: UUID, perfil_id: UUID) {
    const body: RecorridoFinalizarBody = { perfil_id };
    return this.http.post(`${this.API}/recorridos/${recorrido_id}/finalizar`, body, {
      headers: defaultHeaders(),
      observe: 'response'
    });
  }
}
