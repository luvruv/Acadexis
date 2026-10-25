"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";

export async function markAllReadAction() {
  await runAction([ROLES.ADMIN, ROLES.COORDINATOR, ROLES.CO_TEACHER], async (user) => {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
    return { ok: true, message: "Done." };
  });
}