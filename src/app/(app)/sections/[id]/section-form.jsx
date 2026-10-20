"use client";

import { useActionState, useRef, useState } from "react";
import { saveSectionAction } from "./actions";
import FormStatus from "@/components/form-status";
import NativeSelect from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// The outer component keeps the action state (so "Draft saved." survives). The
// inner form is re-created after each save, because the version changes and is
// used as its key.
export default function SectionForm(props) {
  const [state, formAction, isPending] = useActionState(saveSectionAction, {
    ok: null,
    message: "",
  });

  return (
    <SectionFormInner
      key={props.version}
      {...props}
      state={state}
      formAction={formAction}
      isPending={isPending}
    />
  );
}

function Cell({ column, value, onChange, disabled, label }) {
  if (column.type === "textarea") {
    return (
      <Textarea
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={label}
        className="min-w-48"
      />
    );
  }
  if (column.type === "select") {
    return (
      <NativeSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={label}
        className="min-w-32"
      >
        <option value="">-</option>
        {column.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </NativeSelect>
    );
  }
  return (
    <Input
      type={column.type === "time" ? "time" : column.type === "number" ? "number" : "text"}
      min={column.min}
      max={column.max}
      step={column.type === "number" ? "any" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={label}
      className="min-w-28"
    />
  );
}

function TableField({ field, initialRows, readOnly }) {
  const counter = useRef(0);
  const maxRows = field.maxRows ?? 50;

  const blankValues = () => Object.fromEntries(field.columns.map((c) => [c.key, ""]));
  const makeRow = (values) => {
    counter.current += 1;
    return { key: `row-${counter.current}`, values };
  };

  const [rows, setRows] = useState(() => {
    const start = initialRows.length > 0 ? initialRows : [blankValues()];
    return start.map((values) => makeRow({ ...blankValues(), ...values }));
  });

  function addRow() {
    setRows((current) => [...current, makeRow(blankValues())]);
  }

  function removeRow(key) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function setCell(key, columnKey, value) {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, values: { ...row.values, [columnKey]: value } } : row
      )
    );
  }

  const total = field.totalColumn
    ? Math.round(
        rows.reduce((sum, row) => sum + (Number(row.values[field.totalColumn]) || 0), 0) * 100
      ) / 100
    : null;
  const totalColumn = field.columns.find((column) => column.key === field.totalColumn);

  return (
    <div className="space-y-2">
      <input
        type="hidden"
        name={field.name}
        value={JSON.stringify(rows.map((row) => row.values))}
      />
      <Label>{field.label}</Label>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">#</th>
              {field.columns.map((column) => (
                <th key={column.key} className="p-2">
                  {column.label}
                  {column.required && !readOnly ? " *" : ""}
                </th>
              ))}
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={field.columns.length + 2} className="p-3 text-muted-foreground">
                  No rows.
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.key} className="border-t align-top">
                <td className="p-2 text-muted-foreground">{index + 1}</td>
                {field.columns.map((column) => (
                  <td key={column.key} className="p-1">
                    <Cell
                      column={column}
                      value={row.values[column.key]}
                      onChange={(value) => setCell(row.key, column.key, value)}
                      disabled={readOnly}
                      label={`${column.label}, row ${index + 1}`}
                    />
                  </td>
                ))}
                <td className="p-1">
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(row.key)}
                    >
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total !== null && (
        <p
          className={
            field.totalTarget != null && total !== field.totalTarget
              ? "text-sm text-amber-700"
              : "text-sm text-muted-foreground"
          }
        >
          Total {totalColumn?.label ?? ""}: {total}
          {field.totalTarget != null && total !== field.totalTarget
            ? ` (these normally add up to ${field.totalTarget})`
            : ""}
        </p>
      )}

      {!readOnly && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addRow}
          disabled={rows.length >= maxRows}
        >
          Add row
        </Button>
      )}
    </div>
  );
}

function SectionFormInner({
  sectionId,
  version,
  definition,
  content,
  readOnlyReason,
  state,
  formAction,
  isPending,
}) {
  const readOnly = Boolean(readOnlyReason);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="sectionVersion" value={version} />

      {readOnlyReason && (
        <p className="rounded-md border bg-muted p-3 text-sm">{readOnlyReason}</p>
      )}

      {definition.fields.map((field) =>
        field.type === "table" ? (
          <TableField
            key={field.name}
            field={field}
            initialRows={Array.isArray(content[field.name]) ? content[field.name] : []}
            readOnly={readOnly}
          />
        ) : (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={`field-${field.name}`}>
              {field.label}
              {field.required && !readOnly ? " *" : ""}
            </Label>
            <Textarea
              id={`field-${field.name}`}
              name={field.name}
              rows={field.rows ?? 5}
              defaultValue={typeof content[field.name] === "string" ? content[field.name] : ""}
              disabled={readOnly}
            />
          </div>
        )
      )}

      <FormStatus state={state} />

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            name="intent"
            value="draft"
            variant="outline"
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save draft"}
          </Button>
          <Button type="submit" name="intent" value="submit" disabled={isPending}>
            Submit for review
          </Button>
        </div>
      )}
    </form>
  );
}