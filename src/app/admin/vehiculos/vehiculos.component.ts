import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RecoleccionService } from '../../core/services/recoleccion.service';
import { computed } from '@angular/core';

@Component({
  selector: 'app-vehiculos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
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

  // Paginación (cliente)
  pageSize = 10;
  page = signal(1);
  total = computed(() => this.vehiculos().length);
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pagedVehiculos = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.vehiculos().slice(start, start + this.pageSize);
  });
  pagesWindow = computed(() => {
    const tp = this.totalPages();
    const cur = this.page();
    const start = Math.max(1, cur - 3);
    const end = Math.min(tp, cur + 3);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

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
      // Ajustar página si quedó fuera de rango
      if (this.page() > this.totalPages()) this.page.set(this.totalPages());
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
      // Intentar obtener el mensaje más específico del error
      const errorMsg = e?.error?.message
        || e?.error?.error
        || e?.message
        || `No se pudo eliminar el vehículo (Error ${e?.status || 'desconocido'})`;
      this.error.set(errorMsg);
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

  // Controles de paginación
  gotoPage(p: number) { if (p >= 1 && p <= this.totalPages()) this.page.set(p); }
  prevPage() { if (this.page() > 1) this.page.update(x => x - 1); }
  nextPage() { if (this.page() < this.totalPages()) this.page.update(x => x + 1); }
}
