import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";

// When an email does not exist we still run a bcrypt comparison against this
// hash, so "unknown email" and "wrong password" take about the same time.
let dummyHash;
async function getDummyHash() {
  dummyHash ??= await bcrypt.hash("not-a-real-password", 12);
  return dummyHash;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 hours
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });

        const hashToCheck = user?.passwordHash ?? (await getDummyHash());
        const passwordMatches = await bcrypt.compare(password, hashToCheck);

        if (!user || !user.isActive || !passwordMatches) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // Runs when the token is created or read. "user" only exists at sign-in.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    // Shapes what auth() returns to our pages. Display use only: server-side
    // permission checks (Step 9) re-read the role from the database.
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});