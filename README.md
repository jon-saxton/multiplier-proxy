# Multiplier Subdirectory Proxy Cloudflare Worker

This Cloudflare Worker is designed to serve content from an external origin host (`multiplier-origin.captivateiq.com`) under a specific subdirectory path on the main domain (`captivateiq.com/multiplier`).

Features
---------------

- **Subdirectory Proxy:** Maps `captivateiq.com/multiplier/...` requests to the origin's root path (`/...`).
- **Redirect Fixing:** Automatically rewrites absolute and relative HTTP `Location` headers (301/302 redirects) to ensure users stay within the `/multiplier` subdirectory.
- **Link Rewriting (HTMLRewriter):** Scans and fixes all links (`href`, `src`, `action`) within HTML content to prevent users from accidentally navigating to the hidden origin domain.
- **SEO Compliance:** Rewrites `sitemap.xml` and `robots.txt` to use the canonical production URLs.

⚙️ Configuration
----------------

The worker relies on three main constants for configuration:

| Constant | Description | Value |
|----------|-------------|---------------|
| `ORIGIN_HOST` | The hostname of the external site being proxied. | `multiplier-origin.captivateiq.com` |
| `LEGACY_HOST` | Any previous hostnames that may appear in hardcoded links that need to be rewritten. | `multiplier.captivateiq.com` |
| `CANONICAL_BASE` | The public, full URL base path where the content will be hosted. | `https://captivateiq.com/multiplier` |

Deployment Notes
----------------

### 1. Project Setup

This project requires the Cloudflare Workers CLI, `wrangler`.
```bash
# Example: Initialize wrangler
npm install -g wrangler
wrangler init my-proxy-worker
```

### 2. Route Configuration (Critical)

To make this worker function correctly, you must set a Custom Route in your Cloudflare dashboard for the domain `captivateiq.com`.

**Required Route:**

| Field | Value |
|-------|-------|
| **Route** | `captivateiq.com/multiplier*` |
| **Worker** | `<your-worker-name>` |

This ensures that any traffic matching `/multiplier` and anything following it is handled by this script.

### 3. Worker Logic Flow

1. **Request In:** `captivateiq.com/multiplier/pricing`
2. **Path Stripping:** `/multiplier` prefix is removed.
3. **Upstream Request:** Request sent to `multiplier-origin.captivateiq.com/pricing`
4. **Response Out:** The Worker receives the response.
5. **Rewriting:**
   - If it's an HTML response, all internal links are rewritten to start with `/multiplier/`.
   - If it's a redirect, the `Location` header is rewritten to ensure the redirect starts with `https://captivateiq.com/multiplier`.
6. **Client Response:** The modified content is returned to the user.
