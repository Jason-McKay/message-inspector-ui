import { provideZoneChangeDetection } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';

import { AppModule } from './app/app.module';


// Zone-based change detection, made explicit by the Angular 21 migration (zone.js is still loaded).
platformBrowser().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()] })
  .catch(err => console.error(err));
