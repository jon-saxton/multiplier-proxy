// Cloudflare Worker: Multiplier proxy under /multiplier
// Route: captivateiq.com/multiplier*

const ORIGIN_HOST = "multiplier-origin.captivateiq.com";
const LEGACY_HOST = "multiplier.captivateiq.com";
const CANONICAL_BASE = "https://captivateiq.com/multiplier";

export default {
  async fetch(request, env, ctx) {
    const incomingUrl = new URL(request.url);
    const basePath = "/multiplier";

    // Strict path matching to ensure we only proxy intended traffic
    if (!incomingUrl.pathname.startsWith(basePath) || 
       (incomingUrl.pathname.length > basePath.length && incomingUrl.pathname[basePath.length] !== '/')) {
      return fetch(request);
    }

    const upstreamUrl = new URL(incomingUrl.toString());
    upstreamUrl.hostname = ORIGIN_HOST;
    
    let newPath = incomingUrl.pathname.slice(basePath.length);
    upstreamUrl.pathname = newPath || "/";

    const upstreamRequest = new Request(upstreamUrl.toString(), request);
    upstreamRequest.headers.set("Host", ORIGIN_HOST);
    // Remove Accept-Encoding so we can inspect/rewrite the HTML body
    upstreamRequest.headers.delete("Accept-Encoding");

    let originResponse = await fetch(upstreamRequest);

    originResponse = rewriteLocationHeader(originResponse);

    const contentType = originResponse.headers.get("content-type");
    const isHtml = contentType && contentType.includes("text/html");

    if (upstreamUrl.pathname === "/sitemap.xml") return rewriteSitemap(originResponse);
    if (upstreamUrl.pathname === "/robots.txt") return rewriteRobots(originResponse);

    if (isHtml) {
      const hostsToRewrite = [ORIGIN_HOST, LEGACY_HOST];
      return new HTMLRewriter()
        .on("a", new AttributeRewriter("href", hostsToRewrite))
        .on("link", new AttributeRewriter("href", hostsToRewrite))
        .on("img", new AttributeRewriter("src", hostsToRewrite))
        .on("script", new AttributeRewriter("src", hostsToRewrite))
        .on("form", new AttributeRewriter("action", hostsToRewrite))
        .transform(originResponse);
    }

    return originResponse;
  },
};

/**
 * Rewrites HTML attributes (href, src, action) to ensure links stay on the proxy domain.
 * Handles both absolute origin URLs and root-relative paths.
 */
class AttributeRewriter {
  constructor(attributeName, hostsToRewrite) {
    this.attributeName = attributeName;
    this.hostsToRewrite = hostsToRewrite || [];
  }

  element(element) {
    const attribute = element.getAttribute(this.attributeName);
    if (!attribute) return;

    // Handle absolute URLs matching origin or legacy host
    for (const host of this.hostsToRewrite) {
      const absolutePrefix = `https://${host}`;
      if (attribute.startsWith(absolutePrefix)) {
        const newUrl = attribute.replace(absolutePrefix, CANONICAL_BASE);
        element.setAttribute(this.attributeName, newUrl);
        return; 
      }
    }

    // Handle root-relative URLs (e.g. /pricing -> /multiplier/pricing)
    if (attribute.startsWith("/") && !attribute.startsWith("//")) {
      if (!attribute.startsWith("/multiplier")) {
        element.setAttribute(this.attributeName, `/multiplier${attribute}`);
      }
    }
  }
}

/**
 * Rewrites Location headers to handle redirects (both absolute and relative).
 */
function rewriteLocationHeader(originResponse) {
  const location = originResponse.headers.get("Location");
  if (!location) return originResponse;

  let newLocation = location;
  let shouldRewrite = false;

  // Handle relative redirects (e.g. "Location: /login")
  if (location.startsWith("/") && !location.startsWith("//")) {
    newLocation = `/multiplier${location}`;
    shouldRewrite = true;
  } 
  // Handle absolute redirects
  else {
    try {
      const locUrl = new URL(location);
      if (locUrl.hostname === ORIGIN_HOST) {
        const newLocationUrl = new URL(CANONICAL_BASE);
        const basePayload = newLocationUrl.pathname.replace(/\/$/, ""); 
        newLocationUrl.pathname = basePayload + locUrl.pathname;
        newLocationUrl.search = locUrl.search;
        newLocationUrl.hash = locUrl.hash;
        newLocation = newLocationUrl.toString();
        shouldRewrite = true;
      }
    } catch (err) {}
  }

  if (shouldRewrite && newLocation !== location) {
    const headers = new Headers(originResponse.headers);
    headers.set("Location", newLocation);

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    });
  }

  return originResponse;
}

/**
 * Rewrites sitemap.xml to replace origin domains with the canonical base.
 */
async function rewriteSitemap(originResponse) {
  const text = await originResponse.text();
  const originBase = `https://${ORIGIN_HOST}`;
  const rewritten = text.split(originBase).join(CANONICAL_BASE);
  const headers = new Headers(originResponse.headers);
  headers.delete("Content-Length");
  return new Response(rewritten, { status: originResponse.status, headers });
}

/**
 * Rewrites robots.txt to point to the canonical sitemap.
 */
async function rewriteRobots(originResponse) {
  const text = await originResponse.text();
  const originBase = `https://${ORIGIN_HOST}`;
  const rewritten = text.split(originBase).join(CANONICAL_BASE);
  const headers = new Headers(originResponse.headers);
  headers.delete("Content-Length");
  return new Response(rewritten, { status: originResponse.status, headers });
}
