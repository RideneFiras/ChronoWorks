import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/** Next 16 renamed the middleware convention to proxy. Runs before every page
 *  render: refreshes the Supabase session cookie and turns anonymous visitors
 *  away from the signed-in area. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // everything except Next internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
