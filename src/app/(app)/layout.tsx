import { Sidebar } from "@/components/shell/sidebar";
import { displayNameOf, requireSession } from "@/lib/profile";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile, email } = await requireSession();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar displayName={displayNameOf(profile, email)} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto w-full max-w-[1120px]">{children}</div>
      </main>
    </div>
  );
}
