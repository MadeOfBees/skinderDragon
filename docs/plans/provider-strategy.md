# Provider Strategy

## Context

skinderdragon is currently a static browser app. Java lookups use PlayerDB because Mojang's lookup endpoints do not expose browser-friendly CORS headers. Bedrock lookups use GeyserMC, whose skin endpoint only works for players already present in its cache.

The skin and cape images still come from Mojang's texture CDN. The provider question is only about resolving a username or gamertag into those texture URLs.

## Option 1: Stay Fully Static

Keep PlayerDB and GeyserMC calls in the browser, with clear best-effort messaging when a provider cannot resolve a player.

Pros:

- No backend to host, secure, monitor, or pay for.
- GitHub Pages deployment stays simple.
- No server-side abuse/rate-limit surface.
- Easy for contributors to run locally.
- Good fit for a fan tool with no account system or private data.

Cons:

- Provider outages break lookup.
- Provider API or CORS changes can break production without a code change.
- Bedrock support remains inherently partial because GeyserMC is cache-based.
- Harder to add retries, provider fallbacks, or normalized error reporting.

Best when:

- The goal is a lightweight public tool.
- Occasional lookup failure is acceptable.
- Maintenance time should stay near zero.

## Option 2: Add a Small Backend or Worker

Add a minimal proxy, likely a Cloudflare Worker, to resolve players server-side and return normalized texture metadata to the app.

Pros:

- Can call Mojang endpoints directly from the server side.
- Central place for retries, fallback providers, caching, and better errors.
- Reduces exposure to browser CORS changes.
- Gives future flexibility for analytics, rate limiting, and provider health checks.

Cons:

- Adds hosting, deployment, monitoring, and operational ownership.
- Introduces an abuse surface that needs rate limiting.
- Makes local development and PR verification more complex.
- Static GitHub Pages is no longer the whole product.
- Does not fully solve Bedrock skin availability unless a better Bedrock source exists.

Best when:

- Lookup reliability becomes a product requirement.
- The project has someone willing to own backend maintenance.
- There is evidence that PlayerDB/GeyserMC failures are common enough to matter.

## Recommendation

Stay fully static for now. The current product is small, public, and low-risk; a backend would add more operational complexity than the app currently needs.

Revisit this decision if any of these become true:

- PlayerDB or GeyserMC reliability becomes a repeated user complaint.
- The app needs normalized cross-provider error handling.
- The app gains features that already require server-side infrastructure.
- Bedrock support becomes a core promise rather than a best-effort feature.
