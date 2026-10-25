import Link from "next/link";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import NativeSelect from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Repository | Acadexis" };

const PAGE_SIZE = 20;

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RepositoryPage({ searchParams }) {
  const user = await requireRole(ROLES.ADMIN, ROLES.COORDINATOR);
  const params = await searchParams;

  // Everything from the address bar is trimmed and length-limited.
  const q = String(first(params.q) ?? "").trim().slice(0, 100);
  const year = String(first(params.year) ?? "").trim().slice(0, 20);
  const semester = String(first(params.semester) ?? "").trim().slice(0, 50);
  const requestedPage = Number.parseInt(String(first(params.page) ?? "1"), 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const isAdmin = user.role === ROLES.ADMIN;
  // Admins see every document. A coordinator sees only their own.
  const ownership = isAdmin ? {} : { coordinatorId: user.id };

  const where = {
    courseFile: {
      ...ownership,
      ...(year ? { academicYear: year } : {}),
      ...(semester ? { semester: { contains: semester, mode: "insensitive" } } : {}),
    },
    ...(q
      ? {
          OR: [
            { documentId: { contains: q, mode: "insensitive" } },
            { courseFile: { course: { code: { contains: q, mode: "insensitive" } } } },
            { courseFile: { course: { title: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [total, documents, yearRows] = await Promise.all([
    prisma.generatedDocument.count({ where }),
    prisma.generatedDocument.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        courseFile: {
          include: {
            course: { include: { program: { select: { name: true } } } },
            coordinator: { select: { name: true } },
          },
        },
      },
    }),
    prisma.courseFile.findMany({
      where: { ...ownership, generatedDocuments: { some: {} } },
      distinct: ["academicYear"],
      select: { academicYear: true },
      orderBy: { academicYear: "desc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || year || semester);

  function pageHref(target) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (year) query.set("year", year);
    if (semester) query.set("semester", semester);
    query.set("page", String(target));
    return `/repository?${query.toString()}`;
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Repository</h1>
        <p className="text-muted-foreground">
          Officially issued course files{isAdmin ? " from all coordinators" : ""}.
        </p>
      </div>

      <form method="get" className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="q">Course code, title or Document ID</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="e.g. CSE3005 or ACX-CSE3005" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="year">Academic year</Label>
          <NativeSelect id="year" name="year" defaultValue={year}>
            <option value="">All years</option>
            {yearRows.map((row) => (
              <option key={row.academicYear} value={row.academicYear}>
                {row.academicYear}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="semester">Semester</Label>
          <Input id="semester" name="semester" defaultValue={semester} placeholder="e.g. 5" />
        </div>
        <div className="flex gap-2 sm:col-span-4">
          <Button type="submit">Search</Button>
          {hasFilters && (
            <Link
              href="/repository"
              className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      {documents.length === 0 ? (
        <p className="text-muted-foreground">
          {hasFilters
            ? "No issued documents match your search."
            : "No documents have been issued yet."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} document{total === 1 ? "" : "s"} found.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Document ID</th>
                  <th className="p-3">Course</th>
                  <th className="p-3">Semester</th>
                  <th className="p-3">Year</th>
                  {isAdmin && <th className="p-3">Coordinator</th>}
                  <th className="p-3">Issued</th>
                  <th className="p-3">Download</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => {
                  const { courseFile } = document;
                  return (
                    <tr key={document.id} className="border-t align-top">
                      <td className="p-3">
                        <Link
                          href={`/repository/${document.documentId}`}
                          className="font-mono underline"
                        >
                          {document.documentId}
                        </Link>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{courseFile.course.code}</div>
                        <div className="text-muted-foreground">{courseFile.course.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {courseFile.course.program.name}
                        </div>
                      </td>
                      <td className="p-3">{courseFile.semester}</td>
                      <td className="p-3">{courseFile.academicYear}</td>
                      {isAdmin && <td className="p-3">{courseFile.coordinator.name}</td>}
                      <td className="whitespace-nowrap p-3">
                        {formatDateTime(document.generatedAt)}
                      </td>
                      <td className="space-x-3 whitespace-nowrap p-3">
                        <a
                          href={`/api/documents/${document.documentId}?format=pdf`}
                          className="underline"
                        >
                          PDF
                        </a>
                        <a
                          href={`/api/documents/${document.documentId}?format=docx`}
                          className="underline"
                        >
                          DOCX
                        </a>
                      </td>
                    </tr>
                  );
                })}
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