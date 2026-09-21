import { Sidebar } from "@/components/shell/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { Timer } from "@/components/shell/timer";
import { displayNameOf, requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile, email } = await requireSession();

  const supabase = await createClient();
  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase.from("projects").select("id, name, client_id").eq("status", "active").order("name"),
    supabase.from("clients").select("id, name"),
  ]);
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar displayName={displayNameOf(profile, email)} />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-[1120px]">
            {/* The timer dial is always visible (DESIGN.md section 6). */}
            <div className="mb-2 flex justify-end">
              <Timer
                projects={(projects ?? []).map((p) => ({
                  id: p.id,
                  name: p.name,
                  clientName: clientName.get(p.client_id) ?? "—",
                }))}
              />
            </div>
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
