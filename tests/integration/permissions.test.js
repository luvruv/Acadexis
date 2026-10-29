import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  requireRole,
  requireRoleOrThrow,
  requireUser,
  requireUserOrThrow,
} from "@/lib/permissions";
import { makeUser, signInAs } from "./fixtures";

describe("getCurrentUser", () => {
  it("returns null when nobody is signed in", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the user without a password hash", async () => {
    const user = await makeUser("COORDINATOR");
    signInAs(user);
    const current = await getCurrentUser();
    expect(current.id).toBe(user.id);
    expect(current.role).toBe("COORDINATOR");
    expect(current).not.toHaveProperty("passwordHash");
  });

  it("returns null for a deactivated user, even with a valid session", async () => {
    const user = await makeUser("CO_TEACHER", { isActive: false });
    signInAs(user);
    expect(await getCurrentUser()).toBeNull();
  });

  it("uses the role stored in the database, not the one from sign-in time", async () => {
    const user = await makeUser("COORDINATOR");
    signInAs(user);
    await prisma.user.update({ where: { id: user.id }, data: { role: "CO_TEACHER" } });
    expect((await getCurrentUser()).role).toBe("CO_TEACHER");
  });

  it("returns null when the user was deleted", async () => {
    const user = await makeUser("CO_TEACHER");
    signInAs(user);
    await prisma.user.delete({ where: { id: user.id } });
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requireUserOrThrow and requireRoleOrThrow", () => {
  it("throws 401 when signed out", async () => {
    await expect(requireUserOrThrow()).rejects.toMatchObject({
      status: 401,
      message: "Authentication required.",
    });
  });

  it("throws 403 for the wrong role and writes an ACCESS_DENIED audit row", async () => {
    const teacher = await makeUser("CO_TEACHER");
    signInAs(teacher);
    await expect(requireRoleOrThrow("ADMIN")).rejects.toMatchObject({
      status: 403,
      message: "You do not have permission to do this.",
    });
    const rows = await prisma.auditLog.findMany({
      where: { action: "ACCESS_DENIED", userId: teacher.id },
    });
    expect(rows).toHaveLength(1);
  });

  it("allows a listed role", async () => {
    const admin = await makeUser("ADMIN");
    signInAs(admin);
    const user = await requireRoleOrThrow("ADMIN", "COORDINATOR");
    expect(user.id).toBe(admin.id);
  });

  it("treats a deactivated user as signed out (401)", async () => {
    const user = await makeUser("COORDINATOR", { isActive: false });
    signInAs(user);
    await expect(requireRoleOrThrow("COORDINATOR")).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireUser and requireRole (pages)", () => {
  it("redirect to /login when signed out", async () => {
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    await expect(requireRole("ADMIN")).rejects.toThrow("REDIRECT:/login");
  });

  it("redirect to /forbidden for the wrong role", async () => {
    signInAs(await makeUser("CO_TEACHER"));
    await expect(requireRole("ADMIN")).rejects.toThrow("REDIRECT:/forbidden");
  });
});
