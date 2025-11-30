import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export type Vehiculo = {
  id?: string;
  placa: string;
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
  ext_id?: string | null; // id en API de recolección
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
    const { data, error } = await this.supabase.from('vehiculos').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data as Vehiculo[];
  }
  async createVehiculo(v: Vehiculo): Promise<Vehiculo> {
    const { data, error } = await this.supabase.from('vehiculos').insert(v).select('*').single();
    if (error) throw error;
    return data as Vehiculo;
  }
  async updateVehiculo(id: string, v: Partial<Vehiculo>): Promise<Vehiculo> {
    const { data, error } = await this.supabase.from('vehiculos').update(v).eq('id', id).select('*').single();
    if (error) throw error;
    return data as Vehiculo;
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
  async createRuta(r: Ruta): Promise<Ruta> {
    const { data, error } = await this.supabase.from('rutas').insert(r).select('*').single();
    if (error) throw error;
    return data as Ruta;
  }
  async getRuta(id: string): Promise<Ruta | null> {
    const { data, error } = await this.supabase.from('rutas').select('*').eq('id', id).single();
    if (error) return null;
    return data as Ruta;
  }
  async updateRuta(id: string, r: Partial<Ruta>): Promise<Ruta> {
    const { data, error } = await this.supabase.from('rutas').update(r).eq('id', id).select('*').single();
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
