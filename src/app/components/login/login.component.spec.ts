import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let auth: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['apiError']);

    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toast },
      ],
    });
    component = TestBed.createComponent(LoginComponent).componentInstance;
  });

  it('does not attempt login when a field is empty', () => {
    component.username = '';
    component.password = 'secret';

    component.onSubmit();

    expect(auth.login).not.toHaveBeenCalled();
  });

  it('logs in and navigates to the message list on success', () => {
    auth.login.and.returnValue(of({ token: 't', username: 'jason', roles: ['USER'] }));
    component.username = 'jason';
    component.password = 'jason';

    component.onSubmit();

    expect(auth.login).toHaveBeenCalledWith('jason', 'jason');
    expect(router.navigate).toHaveBeenCalledWith(['/messages']);
    expect(component.isSubmitting).toBeFalse();
  });

  it('reports a failed login and stops submitting', () => {
    auth.login.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    component.username = 'jason';
    component.password = 'wrong';

    component.onSubmit();

    expect(toast.apiError).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.isSubmitting).toBeFalse();
  });
});
