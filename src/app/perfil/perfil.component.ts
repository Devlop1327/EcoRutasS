import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss']
})
export class PerfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  saving = signal(false);
  message = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  userEmail = signal<string>('');
  avatar = signal<string | null>(null);

  form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    fullName: [''],
    phone: [''],
    address: [''],
    neighborhood: [''],
    lat: [null as number | null],
    lng: [null as number | null],
    notifyEmail: [true],
    notifyPush: [true]
  });

  constructor() {
    // Esperar a que el servicio de auth termine de cargar antes de verificar usuario
    effect(() => {
      const isLoading = this.auth.isLoading();
      const user = this.auth.currentUser();

      // Solo verificar cuando termine de cargar
      if (!isLoading) {
        if (!user) {
          this.router.navigate(['/auth/login']);
        } else {
          this.loadUserData(user);
        }
      }
    });
  }

  ngOnInit() {
    // La inicialización se maneja en el constructor via effect
  }

  private loadUserData(user: any) {
    this.userEmail.set(user.email || '');
    // cargar avatar desde localStorage (temporal)
    try { this.avatar.set(localStorage.getItem('avatarDataUrl')); } catch { }

    // Aquí cargarías los datos del perfil desde Supabase
    // Por ahora, valores por defecto
    this.form.patchValue({
      username: user.email?.split('@')[0] || '',
      notifyEmail: true,
      notifyPush: true
    });
  }

  async onSubmit() {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.message.set(null);

    try {
      const formData = this.form.getRawValue();

      // Aquí guardarías en Supabase tabla 'profiles' y 'user_addresses'
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Persistir avatar (temporal: localStorage). Si integras Supabase Storage, guarda allí.
      try { if (this.avatar()) localStorage.setItem('avatarDataUrl', this.avatar() as string); } catch { }

      this.message.set({ type: 'success', text: 'Perfil actualizado correctamente' });

      setTimeout(() => this.message.set(null), 3000);
    } catch (e: any) {
      this.message.set({ type: 'error', text: e?.message || 'Error al guardar' });
    } finally {
      this.saving.set(false);
    }
  }

  async logout() {
    await this.auth.signOut();
  }

  getCurrentLocation() {
    if (!navigator.geolocation) {
      this.message.set({ type: 'error', text: 'Geolocalización no disponible' });
      return;
    }

    this.loading.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.form.patchValue({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        this.message.set({ type: 'success', text: 'Ubicación obtenida' });
        this.loading.set(false);
        setTimeout(() => this.message.set(null), 3000);
      },
      (err) => {
        this.message.set({ type: 'error', text: 'No se pudo obtener la ubicación' });
        this.loading.set(false);
      }
    );
  }

  // Manejar selección de archivo de avatar
  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.message.set({ type: 'error', text: 'Archivo no es una imagen' });
      setTimeout(() => this.message.set(null), 3000);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      this.avatar.set(dataUrl);
      try { localStorage.setItem('avatarDataUrl', dataUrl); } catch { }
      try { window.dispatchEvent(new CustomEvent('avatar-changed')); } catch { }
      this.message.set({ type: 'success', text: 'Avatar actualizado Correctamente' });
      setTimeout(() => this.message.set(null), 2000);
    };
    reader.readAsDataURL(file);
  }
}
