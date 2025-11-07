import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RecoleccionService } from '../../core/services/recoleccion.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-vehiculos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatSlideToggleModule
  ],
  templateUrl: './vehiculos.component.html',
  styleUrls: ['./vehiculos.component.scss']
})
export class VehiculosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private reco = inject(RecoleccionService);

  loading = signal(false);
  listLoading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  vehiculos = signal<Array<any>>([]);
  editingId = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    placa: ['', [Validators.required]],
    marca: ['', [Validators.required]],
    modelo: ['', [Validators.required]],
    activo: [true]
  });

  async ngOnInit() {
    await this.loadVehiculos();
  }

  async loadVehiculos() {
    this.listLoading.set(true);
    this.error.set(null);
    try {
      const data = await this.reco.getVehiculos();
      this.vehiculos.set(data);
    } catch (e: any) {
      this.error.set('No se pudieron cargar los vehículos');
    } finally {
      this.listLoading.set(false);
    }
  }

  newVehiculo() {
    this.editingId.set(null);
    this.form.reset({ placa: '', marca: '', modelo: '', activo: true });
  }

  editVehiculo(v: any) {
    this.editingId.set(v.id);
    this.form.reset({
      placa: v.placa || '',
      marca: v.marca || '',
      modelo: v.modelo || '',
      activo: v.activo !== false
    });
  }

  async deleteVehiculo(id: string) {
    if (!id || this.loading()) return;
    const ok = window.confirm('¿Eliminar este vehículo?');
    if (!ok) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.reco.deleteVehiculo(id);
      this.success.set('Vehículo eliminado');
      await this.loadVehiculos();
      this.newVehiculo();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo eliminar el vehículo');
    } finally {
      this.loading.set(false);
      setTimeout(() => this.success.set(null), 2000);
    }
  }

  async save() {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const value = this.form.getRawValue(); // placa, marca, modelo, activo
      if (this.editingId()) {
        await this.reco.updateVehiculo(this.editingId()!, value);
        this.success.set('Vehículo actualizado');
      } else {
        await this.reco.crearVehiculo(value);
        this.success.set('Vehículo creado');
      }
      await this.loadVehiculos();
      this.newVehiculo();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo guardar el vehículo');
    } finally {
      this.loading.set(false);
      setTimeout(() => this.success.set(null), 2000);
    }
  }
}
