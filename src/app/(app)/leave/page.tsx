import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { LeaveScreen } from "./leave-screen";

export default async function LeavePage() {
  const { profile } = await requireSession();

  const supabase = await createClient();
  const { data: leaves } = await supabase
    .from("leaves")
    .select("*")
    .order("start_date", { ascending: false });

  return <LeaveScreen leaves={leaves ?? []} locale={profile.locale} />;
}
