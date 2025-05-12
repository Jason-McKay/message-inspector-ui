import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueueDropdownComponent } from './queue-dropdown.component';

describe('QueueDropdownComponent', () => {
  let component: QueueDropdownComponent;
  let fixture: ComponentFixture<QueueDropdownComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [QueueDropdownComponent]
    });
    fixture = TestBed.createComponent(QueueDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
