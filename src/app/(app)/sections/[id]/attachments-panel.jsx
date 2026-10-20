"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AttachmentsPanel({ sectionId, attachments, editable, min }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleUpload(event) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setMessage({ ok: false, text: "Choose a file first." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ ok: false, text: "File is too large (max 10 MB)." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/sections/${sectionId}/attachments`, {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ok: false, text: data.error ?? "Upload failed." });
      } else {
        inputRef.current.value = "";
        setMessage({ ok: true, text: "Uploaded." });
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this file?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ok: false, text: data.error ?? "Could not delete the file." });
      } else {
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
        <CardTitle>Files</CardTitle>
        <p className="text-sm text-muted-foreground">
          PDF, PNG, JPG, DOCX or XLSX, up to 10 MB each, at most 10 files.
          {min > 0 ? ` At least ${min} file(s) required before you can submit.` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div>
                  <a
                    href={`/api/attachments/${attachment.id}`}
                    className="font-medium underline"
                  >
                    {attachment.name}
                  </a>
                  <div className="text-muted-foreground">
                    {formatSize(attachment.sizeBytes)} · {attachment.uploadedBy} ·{" "}
                    {attachment.uploadedOn}
                  </div>
                </div>
                {editable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleDelete(attachment.id)}
                  >
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {editable && (
          <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-2">
            <Input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
              className="max-w-sm"
              disabled={busy}
              aria-label="Choose a file to upload"
            />
            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? "Working..." : "Upload"}
            </Button>
          </form>
        )}

        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={message.ok ? "text-sm text-green-700" : "text-sm text-red-600"}
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}