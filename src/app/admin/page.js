import { requireRole, ROLES } from "@/lib/permissions";

export const metadata = { title: "Admin | Acadexis" };

export default async function AdminHomePage() {
  const user = await requireRole(ROLES.ADMIN);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold tracking-tight">Admin area</h1>
      <p className="mt-2 text-muted-foreground">
        Program setup and user management will appear here. Signed in as {user.name}.
      </p>
    </main>
  );
}