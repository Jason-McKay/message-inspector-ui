import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  username = '';
  password = '';
  isSubmitting = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private toast: ToastService
  ) {}

  onSubmit(): void {
    if (!this.username || !this.password) {
      return;
    }
    this.isSubmitting = true;
    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/messages']);
      },
      // Bad credentials come back as 401 with the server's message; apiError surfaces it.
      error: (err) => {
        this.isSubmitting = false;
        this.toast.apiError(err, 'Login failed');
      },
    });
  }
}
