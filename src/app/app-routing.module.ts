import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {MessageListComponent} from "./components/message-list/message-list.component";
import { MessageDetailComponent } from './components/message-detail/message-detail.component';
import {QueueListComponent} from "./components/queue-list/queue-list.component";

const routes: Routes = [
  { path: '', redirectTo: 'messages', pathMatch: 'full' }, // Optional: default route
  { path: 'messages', component: MessageListComponent },
  { path: 'messages/:queueName/:messageId', component: MessageDetailComponent },
  { path: 'queues', component: QueueListComponent },
  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
