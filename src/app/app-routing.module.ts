import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {MessageListComponent} from "./components/message-list/message-list.component";
import { MessageDetailComponent } from './components/message-detail/message-detail.component';
import {QueueListComponent} from "./components/queue-list/queue-list.component";

export const routes: Routes = [
  { path: '', redirectTo: 'messages', pathMatch: 'full' }, // Optional: default route
  { path: 'messages', component: MessageListComponent },
  // Deep link to one queue's messages. This is also what MessageDetailComponent returns
  // to after a delete/DLQ and from "Back to List" — without it those navigations fail
  // with NG04002 and silently leave the user on a stale detail page.
  { path: 'messages/:queueName', component: MessageListComponent },
  { path: 'messages/:queueName/:messageId', component: MessageDetailComponent },
  { path: 'queues', component: QueueListComponent },
  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
