import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

/**
 * A plain presentational confirm dialog — an overlay with a message and Yes/Cancel, driven
 * entirely by `@Input`/`@Output` (not a Material dialog). The parent owns the state: it
 * binds `visible`/`actionLabel` and reacts to `confirm`/`cancel`. Destructive actions in
 * both the list and detail views route through this rather than calling the service
 * directly.
 */
@Component({
  selector: 'app-confirmation-modal',
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ConfirmationModalComponent {
  @Input() visible = false;
  @Input() actionLabel = 'Are you sure?';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
