import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: "", renderMode: RenderMode.Prerender },
  { path: "privacy-policy", renderMode: RenderMode.Prerender },
  { path: "faq", renderMode: RenderMode.Prerender },
  { path: "attribution", renderMode: RenderMode.Prerender },
  { path: "**", renderMode: RenderMode.Client },
];
