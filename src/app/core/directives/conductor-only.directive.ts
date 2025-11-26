import { Directive, Input, ElementRef, Renderer2, inject, effect } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Directive({
  selector: '[appConductorOnly]',
  standalone: true
})
export class ConductorOnlyDirective {
  private el = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);
  private auth = inject(AuthService);

  // Si está activo, no oculta el elemento; lo muestra deshabilitado
  @Input('appConductorOnlyDisabledMode') disabledMode = false;

  constructor() {
    effect(() => {
      const role = this.auth.role();
      if (role === 'conductor' || role === 'admin') {
        this.show();
        this.setDisabled(false);
      } else {
        if (this.disabledMode) {
          this.show();
          this.setDisabled(true);
        } else {
          this.hide();
        }
      }
    });
  }

  private hide() {
    this.renderer.setStyle(this.el.nativeElement, 'display', 'none');
  }

  private show() {
    this.renderer.removeStyle(this.el.nativeElement, 'display');
  }

  private setDisabled(state: boolean) {
    const root = this.el.nativeElement;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    do {
      const node = walker.currentNode as HTMLElement;
      try {
        if ('disabled' in node) {
          (node as any).disabled = state;
        }
        if (state) {
          node.setAttribute('aria-disabled', 'true');
        } else {
          node.removeAttribute('aria-disabled');
        }
      } catch {}
    } while (walker.nextNode());
  }
}
