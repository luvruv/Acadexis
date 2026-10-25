import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Reminders | Acadexis" };

export default async function NotificationsPage() {
  const user = await requireUser();

  // Only the signed-in user's own notifications are ever loaded.
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Reminders</h1>
        {unread > 0 && (
          <form action={markAllReadAction}>
            <Button type="submit" variant="outline" size="sm">
              Mark all as read
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-muted-foreground">You have no reminders.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-md border p-3 text-sm ${
                notification.readAt ? "text-muted-foreground" : "bg-muted/40 font-medium"
              }`}
            >
              <div>{notification.message}</div>
              <div className="mt-1 flex gap-3 text-xs font-normal text-muted-foreground">
                <span>{formatDateTime(notification.createdAt)}</span>
                {notification.sectionId && (
                  <Link href={`/sections/${notification.sectionId}`} className="underline">
                    Open section
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}