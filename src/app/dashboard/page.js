import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const ROLE_LABELS = {
  ADMIN: "Admin",
  COORDINATOR: "Coordinator",
  CO_TEACHER: "Co-Teacher",
};

export default async function DashboardPage() {
  const session = await auth();
  // Temporary inline guard. Step 9 replaces this with proper role guards.
  if (!session?.user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p>
        Signed in as <strong>{session.user.name}</strong> (
        {ROLE_LABELS[session.user.role] ?? session.user.role})
      </p>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}