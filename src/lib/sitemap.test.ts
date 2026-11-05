import { describe, expect, it } from "vitest";
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { sitemapStaticPaths, sitemapXML } from "./sitemap";

describe("public sitemap", () => {
  it("includes public pages and excludes sitemap and private descendants", () => {
    const root = createRootRoute({ staticData: { sitemap: false } });
    const pages = ["/", "/woodframe", "/construccion-tradicional", "/mobiliario"].map((path) =>
      createRoute({ getParentRoute: () => root, path, staticData: { sitemap: true } }),
    );
    const sitemap = createRoute({ getParentRoute: () => root, path: "/sitemap.xml", staticData: { sitemap: false } });
    const privateLayout = createRoute({ getParentRoute: () => root, path: "/admin", staticData: { sitemap: "exclude-subtree" } });
    const privatePage = createRoute({ getParentRoute: () => privateLayout, path: "/users", staticData: { sitemap: true } });
    const router = createRouter({ routeTree: root.addChildren([...pages, sitemap, privateLayout.addChildren([privatePage])]) });
    expect(sitemapStaticPaths(router)).toEqual(["/", "/construccion-tradicional", "/mobiliario", "/woodframe"]);
  });

  it("uses the published origin without fabricated modification dates", () => {
    const xml = sitemapXML("https://schconstrucciones.lovable.app", [{ path: "/" }, { path: "/woodframe" }]);
    expect(xml).toContain("<loc>https://schconstrucciones.lovable.app/</loc>");
    expect(xml).toContain("<loc>https://schconstrucciones.lovable.app/woodframe</loc>");
    expect(xml).not.toContain("<lastmod>");
  });
});