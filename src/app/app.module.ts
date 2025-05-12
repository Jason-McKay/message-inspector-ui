import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NoopAnimationsModule, BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MessageListComponent } from './components/message-list/message-list.component';
import { MessageDetailComponent } from './components/message-detail/message-detail.component';
import { ConfirmationModalComponent } from './components/confirmation-modal/confirmation-modal.component';
import { QueueListComponent } from './components/queue-list/queue-list.component';
import { QueueDropdownComponent } from './components/queue-dropdown/queue-dropdown.component';

@NgModule({
  declarations: [
    AppComponent,
    MessageListComponent,
    MessageDetailComponent,
    ConfirmationModalComponent,
    QueueListComponent,
    QueueDropdownComponent
  ],
  imports: [
    HttpClientModule,
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatProgressBarModule,
    BrowserModule,
    AppRoutingModule,
    NoopAnimationsModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot(),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
