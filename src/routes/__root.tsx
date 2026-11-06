import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-semibold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-foreground/70">
          La página que buscás no existe o cambió de lugar.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-foreground"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no se pudo cargar
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          Algo salió mal de nuestro lado. Probá actualizar la página o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-11 items-center justify-center bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-foreground"
          >
            Intentar de nuevo
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center border border-foreground/30 px-5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "SCH Construcciones" },
      { name: "google-site-verification", content: "x188Ch_oRn0G-UjBioQpY_tgduqliVTpo4EFl15DUxc" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "es_UY" },
      { property: "og:site_name", content: "SCH Construcciones" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#171817" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Epilogue:wght@300;400;500;600&family=Urbanist:wght@300;400;500;600;700&display=swap" },
      // La foto principal de la home se pide antes de que el HTML termine de leerse (una versión por tamaño de pantalla).
      { rel: "preload", as: "image", href: "/images/hero-obra-movil.webp", media: "(max-width: 767px)", fetchPriority: "high" },
      { rel: "preload", as: "image", href: "/images/hero-obra-1736.webp", media: "(min-width: 768px)", imageSrcSet: "/images/hero-obra-1280.webp 1280w, /images/hero-obra-1736.webp 1736w", imageSizes: "100vw", fetchPriority: "high" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
