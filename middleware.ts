import { SITE_HOST, LEGACY_HOSTS } from "./src/config/site.js";

export const config = { matcher: "/:path*" };

export default function middleware(req: Request) {
  const url = new URL(req.url);
  if ((LEGACY_HOSTS as readonly string[]).includes(url.hostname)) {
    url.hostname = SITE_HOST;
    return Response.redirect(url, 308);
  }
  /* diagnostic: prove the middleware executes (removed once confirmed) */
  return new Response(null, { headers: { "x-mw-alive": "1", "x-middleware-next": "1" } });
}
