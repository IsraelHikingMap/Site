import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { AppRootComponent } from './application/components/screens/app-root.component';
import { config } from './application/app.config.server';

const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(AppRootComponent, config, context);

export default bootstrap;