import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { QueueDropdownComponent } from './queue-dropdown.component';

describe('QueueDropdownComponent', () => {
  let component: QueueDropdownComponent;
  let fixture: ComponentFixture<QueueDropdownComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule],
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
