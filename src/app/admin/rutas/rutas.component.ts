import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AdminDataService } from '../../core/services/admin-data.service';

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './rutas.component.html',
  styleUrls: ['./rutas.component.scss']
})
export class RutasComponent implements OnInit {
  private admin = inject(AdminDataService);
  private router = inject(Router);

  loading = signal(false);
  listLoading = signal(false);
  error = signal<string | null>(null);
  rutas = signal<Array<any>>([]);

  // Paginación (cliente)
  pageSize = 10;
  page = signal(1);
  total = computed(() => this.rutas().length);
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pagedRutas = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.rutas().slice(start, start + this.pageSize);
  });
  pagesWindow = computed(() => {
    const tp = this.totalPages();
    const cur = this.page();
    const start = Math.max(1, cur - 3);
    const end = Math.min(tp, cur + 3);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
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
      if (this.page() > this.totalPages()) this.page.set(this.totalPages());
    } catch {
      this.error.set('No se pudieron cargar las rutas');
    } finally {
      this.listLoading.set(false);
    }
  }

  gotoEditor() {
    this.router.navigateByUrl('/admin/rutas/editor');
  }

  // Controles de paginación
  gotoPage(p: number) { if (p >= 1 && p <= this.totalPages()) this.page.set(p); }
  prevPage() { if (this.page() > 1) this.page.update(x => x - 1); }
  nextPage() { if (this.page() < this.totalPages()) this.page.update(x => x + 1); }

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
