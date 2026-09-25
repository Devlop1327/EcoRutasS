import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export type Vehiculo = {
  id?: string;
  placa: string;
  marca?: string | null;
  modelo?: string | null;
  ruta_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  activo?: boolean;
  meta?: any;
};

export type Ruta = {
  id?: string;
  nombre: string;
  descripcion?: string | null;
  geometria?: any; // GeoJSON
  coordenadas?: Array<[number, number]> | null;
  estado?: string;
  shape?: any;
  color_hex?: string | null;
  longitud_m?: number | null;
  activo?: boolean;
  ext_id?: string | null;
  updated_at?: string | null;
};

export type Calle = {
  id?: string;
  nombre: string;
  geometria?: any;
  coordenadas?: Array<[number, number]> | null;
};

@Injectable({ providedIn: 'root' })
export class AdminDataService {
  private supabase: SupabaseClient;

  constructor() {
    const supa = inject(SupabaseService);
    this.supabase = supa.client;
  }

  // Vehículos
  async listVehiculos(): Promise<Vehiculo[]> {
    try {
      const { data, error } = await this.supabase
        .from('vehiculos')
        .select('id, placa, marca, modelo, activo')
        .order('id', { ascending: false });

      if (error) throw error;
      return (data ?? []) as Vehiculo[];
    } catch {
      try {
        const { data, error } = await this.supabase
          .from('vehiculos')
          .select('id, placa, activo')
          .order('id', { ascending: false });

        if (error) throw error;
        return (data ?? []) as Vehiculo[];
      } catch {
        return [];
      }
    }
  }

  async createVehiculo(v: Vehiculo): Promise<Vehiculo> {
    const payload: Record<string, any> = {
      placa: v['placa'],
      activo: v['activo'] ?? true,
    };

    if (v['marca'] !== undefined && v['marca'] !== null && v['marca'] !== '') payload['marca'] = v['marca'];
    if (v['modelo'] !== undefined && v['modelo'] !== null && v['modelo'] !== '') payload['modelo'] = v['modelo'];

    try {
      const { data, error } = await this.supabase
        .from('vehiculos')
        .insert(payload)
        .select('id, placa, marca, modelo, activo')
        .single();

      if (error) throw error;
      return data as Vehiculo;
    } catch {
      try {
        const safePayload = { placa: v.placa, activo: v.activo ?? true };
        const { data, error } = await this.supabase
          .from('vehiculos')
          .insert(safePayload)
          .select('id, placa, activo')
          .single();

        if (error) throw error;
        return data as Vehiculo;
      } catch {
        throw new Error('No se pudo crear el vehículo en Supabase. Verifica la estructura de la tabla vehiculos.');
      }
    }
  }

  async updateVehiculo(id: string, v: Partial<Vehiculo>): Promise<Vehiculo> {
    const payload: Record<string, any> = {};

    if (v['placa'] !== undefined) payload['placa'] = v['placa'];
    if (v['activo'] !== undefined) payload['activo'] = v['activo'];
    if (v['marca'] !== undefined) payload['marca'] = v['marca'];
    if (v['modelo'] !== undefined) payload['modelo'] = v['modelo'];

    try {
      const { data, error } = await this.supabase
        .from('vehiculos')
        .update(payload)
        .eq('id', id)
        .select('id, placa, marca, modelo, activo')
        .single();

      if (error) throw error;
      return data as Vehiculo;
    } catch {
      const safePayload: Record<string, any> = {};
      if (v['placa'] !== undefined) safePayload['placa'] = v['placa'];
      if (v['activo'] !== undefined) safePayload['activo'] = v['activo'];

      try {
        const { data, error } = await this.supabase
          .from('vehiculos')
          .update(safePayload)
          .eq('id', id)
          .select('id, placa, activo')
          .single();

        if (error) throw error;
        return data as Vehiculo;
      } catch {
        throw new Error('No se pudo actualizar el vehículo en Supabase. Verifica la estructura de la tabla vehiculos.');
      }
    }
  }
  async deleteVehiculo(id: string): Promise<void> {
    const { error } = await this.supabase.from('vehiculos').delete().eq('id', id);
    if (error) throw error;
  }

  // Rutas
  async listRutas(): Promise<Ruta[]> {
    const { data, error } = await this.supabase.from('rutas').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data as Ruta[];
  }
  private buildRutaPayload(r: Partial<Ruta>): Record<string, any> {
    const payload: Record<string, any> = {};

    if (r['nombre'] !== undefined) payload['nombre'] = r['nombre'];
    if (r['descripcion'] !== undefined) payload['descripcion'] = r['descripcion'] ?? null;
    if (r['geometria'] !== undefined) payload['geometria'] = r['geometria'] ?? null;
    if (r['coordenadas'] !== undefined) payload['coordenadas'] = r['coordenadas'] ?? null;
    if (r['estado'] !== undefined) payload['estado'] = r['estado'] ?? 'activo';
    if (r['shape'] !== undefined) payload['shape'] = r['shape'] ?? null;
    if (r['color_hex'] !== undefined) payload['color_hex'] = r['color_hex'] ?? '#059669';
    if (r['longitud_m'] !== undefined) payload['longitud_m'] = r['longitud_m'] ?? null;
    if (r['activo'] !== undefined) payload['activo'] = r['activo'] ?? true;
    if (r['ext_id'] !== undefined) payload['ext_id'] = r['ext_id'] ?? null;

    return payload;
  }

  async createRuta(r: Ruta): Promise<Ruta> {
    const payload = this.buildRutaPayload(r);
    const { data, error } = await this.supabase
      .from('rutas')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data as Ruta;
  }
  async getRuta(id: string): Promise<Ruta | null> {
    const { data, error } = await this.supabase.from('rutas').select('*').eq('id', id).single();
    if (error) return null;
    return data as Ruta;
  }
  async updateRuta(id: string, r: Partial<Ruta>): Promise<Ruta> {
    const payload = this.buildRutaPayload(r);
    const { data, error } = await this.supabase
      .from('rutas')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as Ruta;
  }
  async deleteRuta(id: string): Promise<void> {
    const { error } = await this.supabase.from('rutas').delete().eq('id', id);
    if (error) throw error;
  }

  // Calles
  async listCalles(): Promise<Calle[]> {
    const { data, error } = await this.supabase.from('calles').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data as Calle[];
    }
  async createCalle(c: Calle): Promise<Calle> {
    const { data, error } = await this.supabase.from('calles').insert(c).select('*').single();
    if (error) throw error;
    return data as Calle;
  }
  async updateCalle(id: string, c: Partial<Calle>): Promise<Calle> {
    const { data, error } = await this.supabase.from('calles').update(c).eq('id', id).select('*').single();
    if (error) throw error;
    return data as Calle;
  }
  async deleteCalle(id: string): Promise<void> {
    const { error } = await this.supabase.from('calles').delete().eq('id', id);
    if (error) throw error;
  }
}
