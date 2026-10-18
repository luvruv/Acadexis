import { requireRole, ROLES } from "@/lib/permissions";

export const metadata = { title: "Coordinator | Acadexis" };

export default async function CoordinatorHomePage() {
  const user = await requireRole(ROLES.COORDINATOR);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold tracking-tight">Coordinator area</h1>
      <p className="mt-2 text-muted-foreground">
        Your course files will appear here. Signed in as {user.name}.
      </p>
    </main>
  );
}