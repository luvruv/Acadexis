import { requireRole, ROLES } from "@/lib/permissions";

export const metadata = { title: "Co-Teacher | Acadexis" };

export default async function TeacherHomePage() {
  const user = await requireRole(ROLES.CO_TEACHER);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold tracking-tight">Co-Teacher area</h1>
      <p className="mt-2 text-muted-foreground">
        Your assigned sections will appear here. Signed in as {user.name}.
      </p>
    </main>
  );
}