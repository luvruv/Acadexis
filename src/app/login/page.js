import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import LoginForm from "./login-form";

export const metadata = { title: "Sign in | Acadexis" };

export default async function LoginPage() {
  // getCurrentUser (not auth) so a disabled account with a leftover cookie is
  // shown the login form instead of being bounced back and forth.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}