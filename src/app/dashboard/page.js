import Link from "next/link";
import { signOut } from "@/lib/auth";
import {
  requireUser,
  ROLE_HOME,
  ROLE_LABELS,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard | Acadexis" };

export default async function DashboardPage() {
  const user = await requireUser();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p>
        Signed in as <strong>{user.name}</strong> ({ROLE_LABELS[user.role]})
      </p>
      <Link href={ROLE_HOME[user.role]} className="underline">
        Go to my area
      </Link>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}