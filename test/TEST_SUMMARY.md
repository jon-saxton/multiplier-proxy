# Test Summary

This document explains what our tests verify and what the results mean.

## Test Results

✅ **All 33 tests passing**

## What We Test

### 1. Path Matching & Routing (6 tests)
**What it does:** Makes sure the worker only handles URLs starting with `/multiplier`

- ✅ Correctly proxies `/multiplier/pricing` to the origin server
- ✅ Handles `/multiplier` (the root) correctly
- ✅ Rejects invalid paths like `/multiplierX` or `/multiplier-test` (passes them through unchanged)
- ✅ Works with trailing slashes like `/multiplier/`
- ✅ Preserves query parameters like `?q=test&filter=active`

**Why it matters:** We don't want to accidentally proxy unrelated URLs.

### 2. HTML Rewriting (11 tests)
**What it does:** Rewrites links, images, and other resources in HTML pages so they work under the `/multiplier` path

- ✅ Rewrites absolute links from the origin host (e.g., `https://multiplier-origin.captivateiq.com/about` → `https://captivateiq.com/multiplier/about`)
- ✅ Rewrites absolute links from the legacy host (e.g., `https://multiplier.captivateiq.com/pricing` → `https://captivateiq.com/multiplier/pricing`)
- ✅ Rewrites root-relative URLs (e.g., `/contact` → `/multiplier/contact`)
- ✅ Doesn't double-prefix already-prefixed URLs (avoids `/multiplier/multiplier/about`)
- ✅ Rewrites image `src` attributes
- ✅ Rewrites script `src` attributes
- ✅ Rewrites form `action` attributes
- ✅ Rewrites stylesheet `href` attributes
- ✅ Leaves protocol-relative URLs alone (e.g., `//cdn.example.com/image.png`)
- ✅ Leaves external URLs alone (e.g., `https://external.com/page`)
- ✅ Handles HTML with no rewritable attributes

**Why it matters:** Without this, links and resources would break because they'd point to the wrong URLs.

### 3. Redirect Handling (6 tests)
**What it does:** Fixes redirect headers so users stay in the `/multiplier` path

- ✅ Rewrites relative redirects (e.g., `Location: /login` → `Location: /multiplier/login`)
- ✅ Rewrites absolute redirects from the origin host
- ✅ Preserves query parameters in redirects (e.g., `?foo=bar&baz=qux`)
- ✅ Preserves hash fragments in redirects (e.g., `#section`)
- ✅ Doesn't modify external redirects (e.g., `https://external.com/page`)
- ✅ Handles responses without Location headers correctly

**Why it matters:** Without this, redirects would send users to the origin domain instead of keeping them on the proxy.

### 4. Special Files (3 tests)
**What it does:** Rewrites SEO-critical files like sitemap.xml and robots.txt

- ✅ Rewrites all URLs in `sitemap.xml` to use the canonical domain
- ✅ Rewrites sitemap reference in `robots.txt`
- ✅ Removes Content-Length header when content is modified

**Why it matters:** Search engines need the correct URLs for proper indexing.

### 5. Edge Cases (7 tests)
**What it does:** Makes sure the worker handles unusual or special situations correctly

- ✅ Passes through non-HTML content without modification (e.g., JSON, images)
- ✅ Handles image content correctly
- ✅ Handles empty or minimal HTML gracefully
- ✅ Sets the correct `Host` header on upstream requests
- ✅ Removes `Accept-Encoding` header (so we can inspect/modify content)
- ✅ Handles deeply nested paths (e.g., `/a/b/c/d/e/page`)
- ✅ Handles multiple different hosts being rewritten in the same HTML

**Why it matters:** Real-world usage includes edge cases, and we want the worker to be robust.

## How to Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Technology

We use:
- **Vitest** - Fast, modern test framework
- **@cloudflare/vitest-pool-workers** - Runs tests in a real Cloudflare Workers environment
- **Mock fetch** - Simulates upstream server responses so we can test in isolation

This means our tests run in the same environment as production, giving us high confidence that everything works correctly.

