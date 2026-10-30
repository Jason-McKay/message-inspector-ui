import { provideZoneChangeDetection } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';


// Zone-based change detection, made explicit by the Angular 21 migration (zone.js is still loaded).
platformBrowserDynamic().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()] })
  .catch(err => console.error(err));
