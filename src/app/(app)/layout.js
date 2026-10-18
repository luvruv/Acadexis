import { requireUser, ROLE_LABELS } from "@/lib/permissions";
import { getNavItems } from "@/lib/navigation";
import SidebarNav from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import { logoutAction } from "./actions";

// This layout is for appearance. Every page, API route and server action
// still runs its own permission check.
export default async function AppLayout({ children }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b bg-muted/30 p-4 md:border-b-0 md:border-r">
        <div className="mb-4 text-lg font-bold tracking-tight">Acadexis</div>
        <SidebarNav items={getNavItems(user.role)} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm">
            <span className="font-medium">{user.name}</span>
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}