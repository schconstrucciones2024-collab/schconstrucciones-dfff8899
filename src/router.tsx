import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Transición suave entre páginas en los navegadores que soportan View Transitions (el CSS respeta prefers-reduced-motion).
    defaultViewTransition: true,
  });

  return router;
};
