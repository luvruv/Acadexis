import StatusBadge from "@/components/status-badge";
import { SECTION_STATUS_LABELS } from "@/lib/labels";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Muted({ children }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Paragraphs({ value }) {
  if (!value) return <Muted>Not provided.</Muted>;
  return <p className="whitespace-pre-wrap text-sm">{value}</p>;
}

function Grid({ columns, rows, empty = "No rows." }) {
  if (rows.length === 0) return <Muted>{empty}</Muted>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="p-2">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t align-top">
              {columns.map((column) => (
                <td key={column.key} className="whitespace-pre-wrap p-2">
                  {row[column.key] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutcomeList({ title, items }) {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length === 0 ? (
        <Muted>None.</Muted>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.code}>
              <span className="font-medium">{item.code}:</span> {item.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionBody({ section }) {
  const { kind, data } = section;

  switch (kind) {
    case "details":
      return (
        <table className="text-sm">
          <tbody>
            {data.rows.map(([label, value]) => (
              <tr key={label}>
                <td className="py-1 pr-6 text-muted-foreground">{label}</td>
                <td className="py-1">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "vision-mission":
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium">{data.name}</p>
          <div>
            <h4 className="text-sm font-semibold">Vision</h4>
            <Paragraphs value={data.vision} />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Mission</h4>
            <Paragraphs value={data.mission} />
          </div>
        </div>
      );

    case "list":
      return data.items.length === 0 ? (
        <Muted>None.</Muted>
      ) : (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {data.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );

    case "program-outcomes":
      return (
        <div className="space-y-4">
          <p className="text-sm font-medium">{data.programName}</p>
          <OutcomeList title="Program Educational Objectives (PEOs)" items={data.peos} />
          <OutcomeList title="Program Outcomes (POs)" items={data.pos} />
          <OutcomeList title="Program Specific Outcomes (PSOs)" items={data.psos} />
        </div>
      );

    case "co-po":
      return data.outcomes.length === 0 ? (
        <Muted>No course outcomes defined yet.</Muted>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-1 text-sm">
            {data.outcomes.map((outcome) => (
              <li key={outcome.code}>
                <span className="font-medium">{outcome.code}:</span> {outcome.description}
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto rounded-md border">
            <table className="text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">CO</th>
                  {data.columns.map((column) => (
                    <th key={column} className="p-2 text-center">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.outcomes.map((outcome) => (
                  <tr key={outcome.code} className="border-t">
                    <td className="p-2 font-medium">{outcome.code}</td>
                    {data.columns.map((column) => (
                      <td key={column} className="p-2 text-center">
                        {data.matrix[outcome.code]?.[column] ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "students":
      return (
        <Grid
          columns={[
            { key: "enrollmentNo", label: "Enrollment no." },
            { key: "rollNo", label: "Roll no." },
            { key: "name", label: "Name" },
            { key: "classGroup", label: "Class group" },
          ]}
          rows={data.students}
          empty="No students yet."
        />
      );

    case "marks":
      return data.components.length === 0 || data.rows.length === 0 ? (
        <Muted>No marks yet.</Muted>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Enrollment no.</th>
                <th className="p-2">Name</th>
                {data.components.map((component) => (
                  <th key={component.name} className="p-2 text-center">
                    {component.name}
                    <div className="text-xs font-normal text-muted-foreground">
                      max {component.maxMarks}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.enrollmentNo} className="border-t">
                  <td className="whitespace-nowrap p-2">{row.enrollmentNo}</td>
                  <td className="whitespace-nowrap p-2">{row.name}</td>
                  {row.values.map((value, index) => (
                    <td key={index} className="p-2 text-center">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "co-attainment": {
      const isNew = data.rows.length > 0 && data.rows[0].average !== undefined;
      const percentOf = (fraction) => Math.round(fraction * 10000) / 100;
      return (
        <div className="space-y-3">
          {data.live && (
            <Muted>
              Live calculation. It is frozen when the course file is locked.
              {data.problems.length > 0 ? ` Not complete: ${data.problems.join(" ")}` : ""}
            </Muted>
          )}
          {data.settings && isNew && (
            <p className="text-sm text-muted-foreground">
              Student Level 3 at {percentOf(data.settings.studentLevel3Min)}% or more, Level 2 at{" "}
              {percentOf(data.settings.studentLevel2Min)}% or more. Target level 3 needs{" "}
              {data.settings.courseLevel3MinPercent}% of students at Level 3, level 2 needs{" "}
              {data.settings.courseLevel2MinPercent}%.
            </p>
          )}
          {data.settings && !data.settings.confirmed && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              {isNew
                ? "These settings are not yet confirmed by the department."
                : `Provisional settings: threshold ${data.settings.thresholdPercent}%, level minimums ${data.settings.level1MinPercent}/${data.settings.level2MinPercent}/${data.settings.level3MinPercent}%. Not yet confirmed by the department.`}
            </p>
          )}
          {data.rows.length === 0 ? (
            <Muted>Not calculated yet.</Muted>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">Course Outcome</th>
                    {data.rows.map((row) => (
                      <th key={row.code} className="p-2 text-center">
                        {row.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="p-2">{isNew ? "Students at Level 3" : "No. of students who attained"}</td>
                    {data.rows.map((row) => (
                      <td key={row.code} className="p-2 text-center">
                        {row.percentage === null
                          ? "-"
                          : isNew
                            ? `${row.attained} of ${row.assessed}`
                            : row.attained}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">{isNew ? "% of students at Level 3" : "% of students who attained"}</td>
                    {data.rows.map((row) => (
                      <td key={row.code} className="p-2 text-center">
                        {row.percentage === null ? "-" : row.percentage.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t font-medium">
                    <td className="p-2">{isNew ? "Target attainment level" : "Attainment level"}</td>
                    {data.rows.map((row) => (
                      <td key={row.code} className="p-2 text-center">
                        {row.level === null ? "-" : row.level}
                      </td>
                    ))}
                  </tr>
                  {isNew && (
                    <tr className="border-t font-medium">
                      <td className="p-2">CO attainment (average of student levels)</td>
                      {data.rows.map((row) => (
                        <td key={row.code} className="p-2 text-center">
                          {row.average === null ? "-" : row.average.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {isNew && data.overall !== null && data.overall !== undefined && (
            <p className="text-sm">
              <strong>Overall course attainment:</strong> {data.overall.toFixed(2)}
            </p>
          )}
        </div>
      );
    }

    case "form":
      return (
        <div className="space-y-4">
          {data.fields.map((field) => (
            <div key={field.label} className="space-y-1">
              <h4 className="text-sm font-semibold">{field.label}</h4>
              {field.type === "table" ? (
                <Grid columns={field.columns} rows={field.rows} />
              ) : (
                <Paragraphs value={field.value} />
              )}
            </div>
          ))}
          {data.hasAttachments && (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Files</h4>
              {data.attachments.length === 0 ? (
                <Muted>No files uploaded.</Muted>
              ) : (
                <ul className="list-disc pl-5 text-sm">
                  {data.attachments.map((file) => (
                    <li key={file.id}>
                      <a href={`/api/attachments/${file.id}`} className="underline">
                        {file.name}
                      </a>{" "}
                      <span className="text-muted-foreground">({formatSize(file.sizeBytes)})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      );

    default:
      return <Muted>{data.message ?? "Nothing has been entered for this section."}</Muted>;
  }
}

export default function CourseFileView({ doc }) {
  return (
    <div className="space-y-8">
      {doc.sections.map((section) => (
        <section key={section.id} className="space-y-3 border-b pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {section.number}. {section.title}
            </h2>
            {!section.isRequired && (
              <span className="text-xs text-muted-foreground">(optional)</span>
            )}
            <StatusBadge status={section.status} labels={SECTION_STATUS_LABELS} />
          </div>
          <SectionBody section={section} />
        </section>
      ))}
    </div>
  );
}