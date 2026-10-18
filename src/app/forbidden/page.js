import Link from "next/link";

export const metadata = { title: "Access denied | Acadexis" };

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Access denied</h1>
      <p className="text-muted-foreground">
        You do not have permission to view that page.
      </p>
      <Link href="/dashboard" className="underline">
        Back to dashboard
      </Link>
    </main>
  );
}