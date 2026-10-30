import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmationModalComponent } from './confirmation-modal.component';

describe('ConfirmationModalComponent', () => {
  let component: ConfirmationModalComponent;
  let fixture: ComponentFixture<ConfirmationModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ConfirmationModalComponent]
    });
    fixture = TestBed.createComponent(ConfirmationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Pins the class rename: .modal-backdrop/.modal-content are Bootstrap 5 globals
  // whose opacity/z-index/background rules fought this component's own styling.
  it('renders under its own class names, not Bootstrap modal classes', () => {
    component.visible = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.confirm-backdrop')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.confirm-dialog')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.modal-backdrop')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.modal-content')).toBeFalsy();
  });

  it('emits confirm and cancel from its buttons', () => {
    component.visible = true;
    fixture.detectChanges();

    const confirmed = jasmine.createSpy('confirmed');
    const cancelled = jasmine.createSpy('cancelled');
    component.confirm.subscribe(confirmed);
    component.cancelled.subscribe(cancelled);

    const buttons: HTMLButtonElement[] =
      Array.from(fixture.nativeElement.querySelectorAll('button'));
    buttons.find((b) => b.textContent?.trim() === 'Yes')!.click();
    buttons.find((b) => b.textContent?.trim() === 'Cancel')!.click();

    expect(confirmed).toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalled();
  });
});
