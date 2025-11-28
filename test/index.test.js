import { describe, it, expect, vi } from "vitest";
import { env, SELF } from "cloudflare:test";
import worker from "../src/index.js";

// Constants from worker.js
const ORIGIN_HOST = "multiplier-origin.captivateiq.com";
const LEGACY_HOST = "multiplier.captivateiq.com";
const CANONICAL_BASE = "https://captivateiq.com/multiplier";

describe("Multiplier Proxy Worker", () => {
  describe("Path Matching and Routing", () => {
    it("should proxy valid /multiplier/* paths", async () => {
      const request = new Request("https://captivateiq.com/multiplier/pricing");
      
      // Mock the upstream fetch
      const mockFetch = vi.fn(async (req) => {
        const url = new URL(req.url);
        expect(url.hostname).toBe(ORIGIN_HOST);
        expect(url.pathname).toBe("/pricing");
        return new Response("OK", { 
          headers: { "content-type": "text/plain" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(mockFetch).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("should proxy /multiplier exactly (root)", async () => {
      const request = new Request("https://captivateiq.com/multiplier");
      
      const mockFetch = vi.fn(async (req) => {
        const url = new URL(req.url);
        expect(url.hostname).toBe(ORIGIN_HOST);
        expect(url.pathname).toBe("/");
        return new Response("OK", { 
          headers: { "content-type": "text/plain" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(mockFetch).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("should NOT proxy /multiplierX (invalid path)", async () => {
      const request = new Request("https://captivateiq.com/multiplierX");
      
      const mockFetch = vi.fn(async (req) => {
        // Should pass through the original request
        return new Response("Passed through", { status: 200 });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(mockFetch).toHaveBeenCalledWith(request);
      const text = await response.text();
      expect(text).toBe("Passed through");
    });

    it("should NOT proxy /multiplier-test (invalid path)", async () => {
      const request = new Request("https://captivateiq.com/multiplier-test");
      
      const mockFetch = vi.fn(async (req) => {
        return new Response("Passed through", { status: 200 });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(mockFetch).toHaveBeenCalledWith(request);
    });

    it("should handle /multiplier/ with trailing slash", async () => {
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async (req) => {
        const url = new URL(req.url);
        expect(url.hostname).toBe(ORIGIN_HOST);
        expect(url.pathname).toBe("/");
        return new Response("OK", { 
          headers: { "content-type": "text/plain" }
        });
      });
      
      global.fetch = mockFetch;
      
      await worker.fetch(request, env, {});
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should preserve query parameters", async () => {
      const request = new Request("https://captivateiq.com/multiplier/search?q=test&filter=active");
      
      const mockFetch = vi.fn(async (req) => {
        const url = new URL(req.url);
        expect(url.search).toBe("?q=test&filter=active");
        return new Response("OK", { 
          headers: { "content-type": "text/plain" }
        });
      });
      
      global.fetch = mockFetch;
      
      await worker.fetch(request, env, {});
      
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("HTML Rewriting", () => {
    it("should rewrite absolute links from origin host", async () => {
      const htmlContent = `
        <html>
          <body>
            <a href="https://multiplier-origin.captivateiq.com/about">About</a>
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('href="https://captivateiq.com/multiplier/about"');
      expect(text).not.toContain(ORIGIN_HOST);
    });

    it("should rewrite absolute links from legacy host", async () => {
      const htmlContent = `
        <html>
          <body>
            <a href="https://multiplier.captivateiq.com/pricing">Pricing</a>
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('href="https://captivateiq.com/multiplier/pricing"');
      expect(text).not.toContain(LEGACY_HOST);
    });

    it("should rewrite root-relative URLs", async () => {
      const htmlContent = `
        <html>
          <body>
            <a href="/contact">Contact</a>
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('href="/multiplier/contact"');
    });

    it("should NOT double-prefix already prefixed URLs", async () => {
      const htmlContent = `
        <html>
          <body>
            <a href="/multiplier/about">About</a>
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('href="/multiplier/about"');
      expect(text).not.toContain('/multiplier/multiplier/about');
    });

    it("should rewrite image src attributes", async () => {
      const htmlContent = `
        <html>
          <body>
            <img src="/images/logo.png" alt="Logo">
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('src="/multiplier/images/logo.png"');
    });

    it("should rewrite script src attributes", async () => {
      const htmlContent = `
        <html>
          <head>
            <script src="/js/main.js"></script>
          </head>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('src="/multiplier/js/main.js"');
    });

    it("should rewrite form action attributes", async () => {
      const htmlContent = `
        <html>
          <body>
            <form action="/submit">
              <input type="text" name="email">
            </form>
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('action="/multiplier/submit"');
    });

    it("should rewrite link href for stylesheets", async () => {
      const htmlContent = `
        <html>
          <head>
            <link rel="stylesheet" href="/css/styles.css">
          </head>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('href="/multiplier/css/styles.css"');
    });

    it("should NOT rewrite protocol-relative URLs", async () => {
      const htmlContent = `
        <html>
          <body>
            <img src="//cdn.example.com/image.png" alt="CDN Image">
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('src="//cdn.example.com/image.png"');
      expect(text).not.toContain('/multiplier//cdn.example.com');
    });

    it("should NOT rewrite external absolute URLs", async () => {
      const htmlContent = `
        <html>
          <body>
            <a href="https://external.com/page">External</a>
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('href="https://external.com/page"');
    });
  });

  describe("Redirect Header Rewriting", () => {
    it("should rewrite relative Location headers", async () => {
      const request = new Request("https://captivateiq.com/multiplier/old-page");
      
      const mockFetch = vi.fn(async () => {
        return new Response(null, {
          status: 302,
          headers: { "Location": "/new-page" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/multiplier/new-page");
    });

    it("should rewrite absolute Location headers from origin host", async () => {
      const request = new Request("https://captivateiq.com/multiplier/redirect-test");
      
      const mockFetch = vi.fn(async () => {
        return new Response(null, {
          status: 301,
          headers: { "Location": `https://${ORIGIN_HOST}/destination` }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe("https://captivateiq.com/multiplier/destination");
    });

    it("should preserve query params in redirect Location headers", async () => {
      const request = new Request("https://captivateiq.com/multiplier/old");
      
      const mockFetch = vi.fn(async () => {
        return new Response(null, {
          status: 302,
          headers: { "Location": `https://${ORIGIN_HOST}/new?foo=bar&baz=qux` }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.headers.get("Location")).toBe("https://captivateiq.com/multiplier/new?foo=bar&baz=qux");
    });

    it("should preserve hash in redirect Location headers", async () => {
      const request = new Request("https://captivateiq.com/multiplier/old");
      
      const mockFetch = vi.fn(async () => {
        return new Response(null, {
          status: 302,
          headers: { "Location": `https://${ORIGIN_HOST}/new#section` }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.headers.get("Location")).toBe("https://captivateiq.com/multiplier/new#section");
    });

    it("should NOT rewrite external redirects", async () => {
      const request = new Request("https://captivateiq.com/multiplier/external");
      
      const mockFetch = vi.fn(async () => {
        return new Response(null, {
          status: 302,
          headers: { "Location": "https://external.com/page" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.headers.get("Location")).toBe("https://external.com/page");
    });

    it("should handle responses without Location header", async () => {
      const request = new Request("https://captivateiq.com/multiplier/no-redirect");
      
      const mockFetch = vi.fn(async () => {
        return new Response("OK", {
          status: 200,
          headers: { "content-type": "text/plain" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(200);
      expect(response.headers.get("Location")).toBeNull();
    });
  });

  describe("Special Files: sitemap.xml and robots.txt", () => {
    it("should rewrite sitemap.xml content", async () => {
      const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://multiplier-origin.captivateiq.com/</loc>
  </url>
  <url>
    <loc>https://multiplier-origin.captivateiq.com/pricing</loc>
  </url>
</urlset>`;
      
      const request = new Request("https://captivateiq.com/multiplier/sitemap.xml");
      
      const mockFetch = vi.fn(async () => {
        return new Response(sitemapContent, {
          headers: { "content-type": "application/xml" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain("https://captivateiq.com/multiplier/");
      expect(text).toContain("https://captivateiq.com/multiplier/pricing");
      expect(text).not.toContain(ORIGIN_HOST);
    });

    it("should rewrite robots.txt content", async () => {
      const robotsContent = `User-agent: *
Allow: /

Sitemap: https://multiplier-origin.captivateiq.com/sitemap.xml`;
      
      const request = new Request("https://captivateiq.com/multiplier/robots.txt");
      
      const mockFetch = vi.fn(async () => {
        return new Response(robotsContent, {
          headers: { "content-type": "text/plain" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain("https://captivateiq.com/multiplier/sitemap.xml");
      expect(text).not.toContain(ORIGIN_HOST);
    });

    it("should remove Content-Length header from rewritten sitemap", async () => {
      const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://multiplier-origin.captivateiq.com/</loc>
  </url>
</urlset>`;
      
      const request = new Request("https://captivateiq.com/multiplier/sitemap.xml");
      
      const mockFetch = vi.fn(async () => {
        return new Response(sitemapContent, {
          headers: { 
            "content-type": "application/xml",
            "content-length": "200"
          }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      // Content-Length should be removed since we modified the body
      expect(response.headers.get("content-length")).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should pass through non-HTML content without rewriting", async () => {
      const jsonContent = JSON.stringify({ url: "/api/endpoint" });
      
      const request = new Request("https://captivateiq.com/multiplier/api/data");
      
      const mockFetch = vi.fn(async () => {
        return new Response(jsonContent, {
          headers: { "content-type": "application/json" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      // JSON should not be modified by HTMLRewriter
      expect(text).toBe(jsonContent);
    });

    it("should pass through image content", async () => {
      const imageData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header
      
      const request = new Request("https://captivateiq.com/multiplier/image.jpg");
      
      const mockFetch = vi.fn(async () => {
        return new Response(imageData, {
          headers: { "content-type": "image/jpeg" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.headers.get("content-type")).toBe("image/jpeg");
    });

    it("should handle empty HTML gracefully", async () => {
      const request = new Request("https://captivateiq.com/multiplier/empty");
      
      const mockFetch = vi.fn(async () => {
        return new Response("<html></html>", {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain("<html>");
    });

    it("should set Host header correctly on upstream request", async () => {
      const request = new Request("https://captivateiq.com/multiplier/test");
      
      const mockFetch = vi.fn(async (req) => {
        expect(req.headers.get("Host")).toBe(ORIGIN_HOST);
        return new Response("OK", { 
          headers: { "content-type": "text/plain" }
        });
      });
      
      global.fetch = mockFetch;
      
      await worker.fetch(request, env, {});
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should remove Accept-Encoding header from upstream request", async () => {
      const request = new Request("https://captivateiq.com/multiplier/test", {
        headers: { "Accept-Encoding": "gzip, deflate, br" }
      });
      
      const mockFetch = vi.fn(async (req) => {
        expect(req.headers.get("Accept-Encoding")).toBeNull();
        return new Response("OK", { 
          headers: { "content-type": "text/plain" }
        });
      });
      
      global.fetch = mockFetch;
      
      await worker.fetch(request, env, {});
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle deep nested paths", async () => {
      const request = new Request("https://captivateiq.com/multiplier/a/b/c/d/e/page");
      
      const mockFetch = vi.fn(async (req) => {
        const url = new URL(req.url);
        expect(url.pathname).toBe("/a/b/c/d/e/page");
        return new Response("OK", { 
          headers: { "content-type": "text/plain" }
        });
      });
      
      global.fetch = mockFetch;
      
      await worker.fetch(request, env, {});
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle HTML with no rewritable attributes", async () => {
      const htmlContent = `
        <html>
          <body>
            <p>No links here</p>
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain("<p>No links here</p>");
    });

    it("should handle multiple host rewrites in same HTML", async () => {
      const htmlContent = `
        <html>
          <body>
            <a href="https://multiplier-origin.captivateiq.com/page1">Origin Link</a>
            <a href="https://multiplier.captivateiq.com/page2">Legacy Link</a>
          </body>
        </html>
      `;
      
      const request = new Request("https://captivateiq.com/multiplier/");
      
      const mockFetch = vi.fn(async () => {
        return new Response(htmlContent, {
          headers: { "content-type": "text/html" }
        });
      });
      
      global.fetch = mockFetch;
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      expect(text).toContain('href="https://captivateiq.com/multiplier/page1"');
      expect(text).toContain('href="https://captivateiq.com/multiplier/page2"');
      expect(text).not.toContain(ORIGIN_HOST);
      expect(text).not.toContain(LEGACY_HOST);
    });
  });
});

