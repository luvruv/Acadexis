"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ExportPanel({ courseFileId, status, documents }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  if (status !== "LOCKED" && status !== "EXPORTED") return null;

  async function handleExport() {
    if (
      !window.confirm(
        "Issue the official copy? This creates the Document ID and cannot be undone."
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/course-files/${courseFileId}/export`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ok: false, text: data.error ?? "Export failed." });
      } else {
        setMessage({ ok: true, text: `Issued ${data.documentId}.` });
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Official export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {documents.length === 0 ? (
          <>
            <p>
              The course file is locked. Export it to issue the official Document ID and
              the DOCX and PDF copies.
            </p>
            <Button type="button" onClick={handleExport} disabled={busy}>
              {busy ? "Generating (up to 30 seconds)..." : "Export official copy"}
            </Button>
          </>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Document ID</th>
                  <th className="p-2">Issued</th>
                  <th className="p-2">By</th>
                  <th className="p-2">Annexures</th>
                  <th className="p-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.documentId} className="border-t align-top">
                    <td className="p-2 font-mono">{document.documentId}</td>
                    <td className="p-2">{document.generatedOn}</td>
                    <td className="p-2">{document.generatedBy}</td>
                    <td className="p-2">{document.annexureCount}</td>
                    <td className="space-x-3 whitespace-nowrap p-2">
                      <a
                        href={`/api/documents/${document.documentId}?format=pdf`}
                        className="underline"
                      >
                        PDF ({formatSize(document.pdfBytes)})
                      </a>
                      <a
                        href={`/api/documents/${document.documentId}?format=docx`}
                        className="underline"
                      >
                        DOCX ({formatSize(document.docxBytes)})
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={message.ok ? "text-green-700" : "text-red-600"}
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}