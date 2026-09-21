import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale } from "@/i18n/locale";

/** Google sends the user back here. Swap the code for a session, then mirror
 *  the profile locale into the cookie so the first render is in the right
 *  language. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=exchange`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const { data } = await supabase.from("profiles").select("locale").single();
  if (data && isLocale(data.locale)) {
    response.cookies.set(LOCALE_COOKIE, data.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}
