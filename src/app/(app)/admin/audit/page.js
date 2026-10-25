import Link from "next/link";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import NativeSelect from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Audit log | Acadexis" };

const PAGE_SIZE = 50;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACTION_PATTERN = /^[A-Z_]{1,60}$/;
const SENSITIVE_KEY = /pass|secret|token|hash/i;

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

// Parses a yyyy-mm-dd value from the address bar. Anything else is ignored.
function parseDate(value, endOfDay) {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function short(value) {
  const text = typeof value === "string" ? value : String(JSON.stringify(value));
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function describeDetails(details) {
  if (details === null || details === undefined) return [];
  if (typeof details !== "object" || Array.isArray(details)) return [["value", short(details)]];
  return Object.entries(details).map(([key, value]) => [
    key,
    SENSITIVE_KEY.test(key) ? "[hidden]" : short(value),
  ]);
}

export default async function AuditLogPage({ searchParams }) {
  await requireRole(ROLES.ADMIN);
  const params = await searchParams;

  const action = String(first(params.action) ?? "").trim();
  const userId = String(first(params.user) ?? "").trim().slice(0, 40);
  const from = String(first(params.from) ?? "").trim();
  const to = String(first(params.to) ?? "").trim();
  const q = String(first(params.q) ?? "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(String(first(params.page) ?? "1"), 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const fromDate = parseDate(from, false);
  const toDate = parseDate(to, true);

  const where = {
    ...(ACTION_PATTERN.test(action) ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { entityType: { contains: q, mode: "insensitive" } },
            { entityId: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, events, actionRows, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(action || userId || from || to || q);

  function pageHref(target) {
    const query = new URLSearchParams();
    if (action) query.set("action", action);
    if (userId) query.set("user", userId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (q) query.set("q", q);
    query.set("page", String(target));
    return `/admin/audit?${query.toString()}`;
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground">
          A read-only record of important actions. Entries cannot be edited or deleted.
        </p>
      </div>

      <form method="get" className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="action">Action</Label>
          <NativeSelect id="action" name="action" defaultValue={action}>
            <option value="">All actions</option>
            {actionRows.map((row) => (
              <option key={row.action} value={row.action}>
                {row.action}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="user">User</Label>
          <NativeSelect id="user" name="user" defaultValue={userId}>
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="q">Entity type or id</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="e.g. CourseFile, or part of an id or an email"
          />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2">
          <Button type="submit">Filter</Button>
          {hasFilters && (
            <Link
              href="/admin/audit"
              className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      {events.length === 0 ? (
        <p className="text-muted-foreground">No events match these filters.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} event{total === 1 ? "" : "s"} found.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t align-top">
                    <td className="whitespace-nowrap p-3">{formatDateTime(event.createdAt)}</td>
                    <td className="p-3">
                      {event.user ? (
                        <>
                          <div>{event.user.name}</div>
                          <div className="text-xs text-muted-foreground">{event.user.email}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{event.action}</td>
                    <td className="p-3">
                      <div>{event.entityType}</div>
                      {event.entityId && (
                        <div className="break-all font-mono text-xs text-muted-foreground">
                          {event.entityId}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {describeDetails(event.details).map(([key, value]) => (
                        <div key={key} className="break-all text-xs">
                          <span className="text-muted-foreground">{key}:</span> {value}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-4 text-sm">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="underline">
                  Previous
                </Link>
              ) : (
                <span className="text-muted-foreground">Previous</span>
              )}
              <span>
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="underline">
                  Next
                </Link>
              ) : (
                <span className="text-muted-foreground">Next</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}