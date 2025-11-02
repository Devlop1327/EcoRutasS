import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RecoleccionService } from '../../core/services/recoleccion.service';
import { AdminDataService } from '../../core/services/admin-data.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule
  ],
  templateUrl: './rutas.component.html',
  styleUrls: ['./rutas.component.scss']
})
export class RutasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private reco = inject(RecoleccionService);
  private admin = inject(AdminDataService);
  private router = inject(Router);

  loading = signal(false);
  listLoading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  rutas = signal<Array<any>>([]);

  unionForm = this.fb.nonNullable.group({
    nombre_ruta: ['', [Validators.required]],
    calles_ids: [''] // coma o salto de línea separados
  });

  async ngOnInit() {
    await this.loadRutas();
  }

  async loadRutas() {
    this.listLoading.set(true);
    this.error.set(null);
    try {
      const data = await this.admin.listRutas();
      this.rutas.set(data);
    } catch {
      this.error.set('No se pudieron cargar las rutas');
    } finally {
      this.listLoading.set(false);
    }
  }

  gotoEditor() {
    this.router.navigateByUrl('/admin/rutas/editor');
  }

  async crearPorUnion() {
    if (this.loading() || this.unionForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const { nombre_ruta, calles_ids } = this.unionForm.getRawValue();
      const parsed = (calles_ids || '')
        .split(/\s|,|;|\n/)
        .map(s => s.trim())
        .filter(Boolean);
      await this.reco.crearRuta({ nombre_ruta, calles_ids: parsed.length ? parsed : undefined });
      // Crear registro básico también en Supabase
      await this.admin.createRuta({ nombre: String(nombre_ruta || 'Ruta'), descripcion: 'Generada por unión de calles' });
      this.success.set('Ruta creada');
      await this.loadRutas();
      this.unionForm.reset({ nombre_ruta: '', calles_ids: '' });
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo crear la ruta');
    } finally {
      this.loading.set(false);
      setTimeout(() => this.success.set(null), 2000);
    }
  }

  async eliminar(id: string) {
    if (!id) return;
    const ok = window.confirm('¿Eliminar esta ruta? Esta acción no se puede deshacer.');
    if (!ok) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.admin.deleteRuta(id);
      await this.loadRutas();
    } catch (e: any) {
      this.error.set(e?.message || 'No se pudo eliminar la ruta');
    } finally {
      this.loading.set(false);
    }
  }
}
