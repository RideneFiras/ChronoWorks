import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/database.types";

export interface Session {
  userId: string;
  email: string | null;
  profile: ProfileRow;
}

/**
 * Every signed-in page starts here. The middleware already redirected anonymous
 * visitors, so reaching this without a user means the session died mid-request.
 */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // The trigger creates this row at sign-up; if it is missing the database
    // is not in the state 0001_init.sql leaves it in.
    throw new Error(
      `No profile row for the signed-in user. Check that 0001_init.sql ran, including the on_auth_user_created trigger. (${error?.message ?? "no row"})`,
    );
  }

  return { userId: user.id, email: user.email ?? null, profile };
}

export function displayNameOf(profile: ProfileRow, email: string | null): string {
  return profile.display_name?.trim() || email?.split("@")[0] || "—";
}
