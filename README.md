# Proxy Subdirectory Proxy Cloudflare Worker

This Cloudflare Worker is designed to serve content from an external origin host (`proxy-origin.captivateiq.com`) under a specific subdirectory path on the main domain (`captivateiq.com/proxy`).

## Project Structure

- **Worker Code:** [`src/index.js`](src/index.js) - The main worker logic
- **Configuration:** [`wrangler.toml`](wrangler.toml) - Cloudflare Worker settings
- **Tests:** [`test/index.test.js`](test/index.test.js) - Comprehensive test suite (33 tests)
- **Test Summary:** [`test/TEST_SUMMARY.md`](test/TEST_SUMMARY.md) - Human-readable explanation of what's tested

## Features
---------------

- **Subdirectory Proxy:** Maps `captivateiq.com/proxy/...` requests to the origin's root path (`/...`).
- **Redirect Fixing:** Automatically rewrites absolute and relative HTTP `Location` headers (301/302 redirects) to ensure users stay within the `/proxy` subdirectory.
- **Link Rewriting (HTMLRewriter):** Scans and fixes all links (`href`, `src`, `action`) within HTML content to prevent users from accidentally navigating to the hidden origin domain.
- **SEO Compliance:** Rewrites `robots.txt` to use the canonical production URLs. `sitemap.xml` rewrite is temporarily disabled post-launch; see note below.

⚙️ Configuration
----------------

The worker relies on three main constants for configuration:

| Constant | Description | Value |
|----------|-------------|---------------|
| `ORIGIN_HOST` | The hostname of the external site being proxied. | `proxy-origin.captivateiq.com` |
| `LEGACY_HOST` | Any previous hostnames that may appear in hardcoded links that need to be rewritten. | `proxy.captivateiq.com` |
| `CANONICAL_BASE` | The public, full URL base path where the content will be hosted. | `https://captivateiq.com/proxy` |

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

See [`test/TEST_SUMMARY.md`](test/TEST_SUMMARY.md) for detailed information about what's tested.

## Deployment Notes
----------------

### Post-launch follow-up

A week or two post-launch, update the worker to re-enable the sitemap rewrite so search engines have time to process the redirects naturally before we rewrite `sitemap.xml`.

### 1. Project Setup

Install dependencies:
```bash
npm install
```

### 2. Route Configuration (Critical)

To make this worker function correctly, you must set a Custom Route in your Cloudflare dashboard for the domain `captivateiq.com`.

**Required Route:**

| Field | Value |
|-------|-------|
| **Route** | `captivateiq.com/proxy*` |
| **Worker** | `<your-worker-name>` |

This ensures that any traffic matching `/proxy` and anything following it is handled by this script.

### 3. Worker Logic Flow

1. **Request In:** `captivateiq.com/proxy/pricing`
2. **Path Stripping:** `/proxy` prefix is removed.
3. **Upstream Request:** Request sent to `proxy-origin.captivateiq.com/pricing`
4. **Response Out:** The Worker receives the response.
5. **Rewriting:**
   - If it's an HTML response, all internal links are rewritten to start with `/proxy/`.
   - If it's a redirect, the `Location` header is rewritten to ensure the redirect starts with `https://captivateiq.com/proxy`.
6. **Client Response:** The modified content is returned to the user.
