import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';

interface Role {
  id: string;
  name: string;
}

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './role-selector.component.html',
  styleUrls: ['./role-selector.component.scss']
})
export class RoleSelectorComponent implements OnInit {
  private sb = inject(SupabaseService);
  private fb = inject(FormBuilder);

  roles = signal<Role[]>([]);
  loading = signal(false);
  saving = signal(false);
  message = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  isAdmin = signal(false);
  currentUserRole = signal<string>('');
  currentRoleName = signal<string>('');

  // Roles disponibles para usuario no-admin (cliente y conductor)
  userSelectableRoles = signal<Role[]>([]);

  // Computed para determinar si el usuario puede editar su rol
  canEditRole = computed(() => !this.isAdmin() && this.userSelectableRoles().length > 0);

  form = this.fb.group({
    roleId: ['', Validators.required]
  }, { updateOn: 'change' });

  ngOnInit() {
    this.loadCurrentUserRole();
    this.loadRoles();
  }

  private disableForm() {
    this.form.get('roleId')?.disable();
  }

  private enableForm() {
    this.form.get('roleId')?.enable();
  }

  async loadRoles() {
    this.loading.set(true);
    try {
      const { data, error } = await this.sb.client
        .from('roles')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading roles:', error);
        this.message.set({
          type: 'error',
          text: 'No se pudieron cargar los roles'
        });
        this.loading.set(false);
        return;
      }

      this.roles.set(data ?? []);

      // Filtrar solo cliente y conductor para usuarios no-admin
      const selectableRoles = (data ?? []).filter(r =>
        r.name.toLowerCase() === 'cliente' || r.name.toLowerCase() === 'conductor'
      );
      this.userSelectableRoles.set(selectableRoles);
    } catch (err) {
      console.error('Unexpected error loading roles:', err);
      this.message.set({
        type: 'error',
        text: 'Error inesperado al cargar los roles'
      });
    } finally {
      this.loading.set(false);
    }
  }

  async loadCurrentUserRole() {
    try {
      const { data: { user } = {} } = await this.sb.client.auth.getUser();

      if (!user?.id) {
        console.warn('No authenticated user found');
        return;
      }

      const { data, error } = await this.sb.client
        .from('profiles')
        .select('role_id, role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      // Guardar el rol actual
      if (data?.role_id) {
        this.form.patchValue({
          roleId: data.role_id
        });
        this.currentUserRole.set(data.role_id);
      }

      // Guardar el nombre del rol actual
      if (data?.role) {
        this.currentRoleName.set(data.role);
      }

      // Verificar si es admin
      this.isAdmin.set(data?.role === 'admin');
    } catch (err) {
      console.error('Unexpected error loading current user role:', err);
    }
  }

  async onSave() {
    if (this.form.invalid) {
      this.message.set({
        type: 'error',
        text: 'Por favor selecciona un rol'
      });
      return;
    }

    try {
      const { data: { user } = {} } = await this.sb.client.auth.getUser();

      if (!user?.id) {
        this.message.set({
          type: 'error',
          text: 'Usuario no autenticado'
        });
        return;
      }

      const selectedRoleId = this.form.get('roleId')?.value;
      if (!selectedRoleId) {
        this.message.set({
          type: 'error',
          text: 'Selecciona un rol'
        });
        return;
      }

      // Obtener nombre del rol seleccionado para mantener role (texto)
      const roleData = this.isAdmin()
        ? this.roles().find(r => r.id === selectedRoleId)
        : this.userSelectableRoles().find(r => r.id === selectedRoleId);

      const role = roleData?.name ?? null;

      this.saving.set(true);
      this.disableForm();

      const { data, error } = await this.sb.client
        .from('profiles')
        .upsert(
          {
            id: user.id,
            role_id: selectedRoleId,
            role: role,
            updated_at: new Date().toISOString()
          }
        )
        .select();

      if (error) {
        console.error('Error updating profile role:', error);
        this.message.set({
          type: 'error',
          text: 'Error al guardar el rol: ' + error.message
        });
        this.enableForm();
        return;
      }

      // Actualizar el estado local
      this.currentRoleName.set(role || '');
      this.currentUserRole.set(selectedRoleId);

      this.message.set({
        type: 'success',
        text: 'Rol actualizado correctamente: ' + role
      });

      this.enableForm();

      // Limpiar mensaje después de 3 segundos
      setTimeout(() => {
        this.message.set(null);
      }, 3000);
    } catch (err) {
      console.error('Unexpected error saving role:', err);
      this.message.set({
        type: 'error',
        text: 'Error inesperado al guardar el rol'
      });
      this.enableForm();
    } finally {
      this.saving.set(false);
    }
  }
}
