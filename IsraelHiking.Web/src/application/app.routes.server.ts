import { RenderMode, ServerRoute } from "@angular/ssr";

export const serverRoutes: ServerRoute[] = [
  {
    path: "faq",
    renderMode: RenderMode.Prerender
  },
  {
    path: "**",
    renderMode: RenderMode.Client,
  }
];
