import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RecoleccionService } from '../../core/services/recoleccion.service';
import { AdminDataService } from '../../core/services/admin-data.service';
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
  private admin = inject(AdminDataService);

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
    placa: ['', [Validators.required, Validators.pattern('^[A-Z]{3}-[0-9]{3}$')]],
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
      let data: any[] = [];

      try {
        data = await this.admin.listVehiculos();
      } catch {
        data = await this.reco.getVehiculos();
      }

      this.vehiculos.set(data);
      if (this.page() > this.totalPages()) this.page.set(this.totalPages());
    } catch (e: any) {
      this.error.set('No se pudieron cargar los vehículos');
    } finally {
      this.listLoading.set(false);
    }
  }

  onPlacaInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const next = this.formatPlaca(input.value);
    input.value = next;
    this.form.controls.placa.setValue(next, { emitEvent: false });
  }

  toUpperCaseInput(event: Event, field: 'marca' | 'modelo') {
    const input = event.target as HTMLInputElement;
    const next = input.value.toUpperCase();
    input.value = next;
    this.form.controls[field].setValue(next, { emitEvent: false });
  }

  private formatPlaca(value: string): string {
    const cleaned = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);

    if (cleaned.length <= 3) {
      return cleaned;
    }

    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
  }

  newVehiculo() {
    this.editingId.set(null);
    this.form.reset({ placa: '', marca: '', modelo: '', activo: true });
  }

  @ViewChild('formDetails') formDetails?: ElementRef<HTMLDetailsElement>;

  editVehiculo(v: any) {
    this.editingId.set(v.id);
    this.form.reset({
      placa: v.placa || '',
      marca: v.marca || '',
      modelo: v.modelo || '',
      activo: v.activo !== false
    });

    // Auto-expandir y scroll al formulario
    if (this.formDetails?.nativeElement) {
      this.formDetails.nativeElement.open = true;
      this.formDetails.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
      const value = this.form.getRawValue();
      const payload = {
        placa: value.placa.trim(),
        marca: value.marca.trim(),
        modelo: value.modelo.trim(),
        activo: Boolean(value.activo),
      };
      const supabasePayload = {
        placa: value.placa.trim(),
        marca: value.marca.trim(),
        modelo: value.modelo.trim(),
        activo: Boolean(value.activo),
      };

      if (this.editingId()) {
        try {
          await this.admin.updateVehiculo(this.editingId()!, supabasePayload as any);
        } catch {
          await this.reco.updateVehiculo(this.editingId()!, payload);
        }
        this.success.set('Vehículo actualizado');
      } else {
        try {
          await this.admin.createVehiculo(supabasePayload as any);
        } catch {
          await this.reco.crearVehiculo(payload);
        }
        this.success.set('Vehículo creado');
      }

      await this.loadVehiculos();
      this.newVehiculo();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'No se pudo guardar el vehículo');
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
