import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {MessageListComponent} from "./components/message-list/message-list.component";
import { MessageDetailComponent } from './components/message-detail/message-detail.component';
import {QueueListComponent} from "./components/queue-list/queue-list.component";
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  // Login is the only route reachable without a session; everything else is behind authGuard.
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'messages', pathMatch: 'full' }, // Optional: default route
  { path: 'messages', component: MessageListComponent, canActivate: [authGuard] },
  // Deep link to one queue's messages. This is also what MessageDetailComponent returns
  // to after a delete/DLQ and from "Back to List" — without it those navigations fail
  // with NG04002 and silently leave the user on a stale detail page.
  { path: 'messages/:queueName', component: MessageListComponent, canActivate: [authGuard] },
  { path: 'messages/:queueName/:messageId', component: MessageDetailComponent, canActivate: [authGuard] },
  { path: 'queues', component: QueueListComponent, canActivate: [authGuard] },
  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
