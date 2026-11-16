import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminApplications } from "@/lib/account-opening.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "New Customers — Kindred Bank Admin" },
      {
        name: "description",
        content: "Private fictional customer applications and account exports.",
      },
      { property: "og:title", content: "New Customers — Kindred Bank Admin" },
      { property: "og:description", content: "Review fictional customer records and documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Customers,
});
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function emailCheck(a: { details: unknown; email_verified_at: string | null }) {
  const details = a.details as { email_mode?: string };
  return a.email_verified_at ? details.email_mode === "simulated" ? "Simulated email verification" : a.email_verified_at : "Not verified";
}
function Customers() {
  const fetch = useServerFn(adminApplications);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({ queryKey: ["admin-applications"], queryFn: () => fetch() });
  const [q, setQ] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const list = data.filter((a) =>
    `${a.full_name} ${a.email} ${a.reference}`.toLowerCase().includes(q.toLowerCase()),
  );
  const head = [
    "Reference",
    "Name",
    "Email",
    "Phone",
    "Channel",
    "Status",
    "Identity check",
    "Email verified",
    "Account",
    "Product",
    "Holder",
    "Fictional deposit (NGN)",
    "Application details",
    "Document status",
  ];
  const rows = list.flatMap((a) =>
    (a.bank_accounts.length ? a.bank_accounts : [null]).map((acc) => [
      a.reference,
      a.full_name,
      a.email,
      a.phone,
      a.channel,
      a.status,
      a.identity_status,
      emailCheck(a),
      acc?.account_number || "",
      acc?.product || "",
      acc?.holder_name || "",
      acc?.opening_deposit || 0,
      JSON.stringify(a.details),
      JSON.stringify(
        Object.fromEntries(
          Object.entries(a.documents as Record<string, unknown>).map(([k, v]) => [
            k,
            typeof v === "object" && v !== null && "name" in v ? String(v.name) : String(v),
          ]),
        ),
      ),
    ]),
  );
  async function exportFile(type: "excel" | "pdf") {
    setBusy(true);
    try {
      if (type === "excel") {
        const X = await import("xlsx");
        const wb = X.utils.book_new();
        const ws = X.utils.aoa_to_sheet([head, ...rows]);
        ws["!cols"] = head.map(() => ({ wch: 24 }));
        X.utils.book_append_sheet(wb, ws, "Fictional customers");
        save(
          new Blob([X.write(wb, { type: "array", bookType: "xlsx" })], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          "kindred-new-customers.xlsx",
        );
      } else {
        const { jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({ orientation: "landscape" });
        const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (ctx) { ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--primary"); ctx.fillRect(0,0,1,1); }
        const pixel = ctx?.getImageData(0,0,1,1).data;
        doc.text("Kindred Bank — Fictional customer records", 14, 14);
        for (const [i, a] of list.entries()) {
          if (i) doc.addPage();
          doc.setFontSize(12);
          doc.text(`${a.reference} — ${a.full_name}`, 14, 24);
          autoTable(doc, {
            startY: 30,
            head: [["Field", "Value"]],
            body: [
              ["Email", a.email],
              ["Phone", a.phone],
              ["Status", a.status],
              ["Identity check", a.identity_status],
              ["Email verified", emailCheck(a)],
              ...Object.entries(a.details as Record<string, unknown>).map(([k, v]) => [
                k,
                typeof v === "object" ? JSON.stringify(v) : String(v),
              ]),
              ...a.bank_accounts.map((acc) => [
                acc.product,
                `${acc.account_number}; ${acc.holder_name}; NGN ${acc.opening_deposit}`,
              ]),
              [
                "Documents",
                JSON.stringify(
                  Object.fromEntries(
                    Object.entries(a.documents as Record<string, unknown>).map(([k, v]) => [
                      k,
                      typeof v === "object" && v !== null && "name" in v
                        ? String(v.name)
                        : String(v),
                    ]),
                  ),
                ),
              ],
            ],
            styles: { fontSize: 9 },
            headStyles: pixel ? { fillColor: [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0] } : {},
          });
        }
        save(doc.output("blob"), "kindred-new-customers.pdf");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  const a = data.find((a) => a.id === selected);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">New Customers</h1>
      <p className="text-sm text-muted-foreground">
        {data.length} fictional applications •{" "}
        {data.reduce((n, a) => n + a.bank_accounts.length, 0)} test accounts. Imported records have
        no email verification; all identity checks are simulated.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Search customers"
          className="max-w-sm"
          placeholder="Search customers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button disabled={busy || !list.length} onClick={() => exportFile("excel")}>
          Download Excel
        </Button>
        <Button variant="outline" disabled={busy || !list.length} onClick={() => exportFile("pdf")}>
          Download PDF
        </Button>
      </div>
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert">Could not load customer records.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b">
            <tr>
              {["Customer", "Accounts", "Status", "Source", ""].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="p-3">
                  <p className="font-semibold">{a.full_name}</p>
                  <p>{a.email}</p>
                  <p className="text-xs text-muted-foreground">{a.reference}</p>
                </td>
                <td className="p-3">
                  {a.bank_accounts.map((acc) => (
                    <p key={acc.id}>
                      {acc.product} — {acc.account_number}
                    </p>
                  ))}
                </td>
                <td className="p-3">
                  {a.status}
                  <p className="text-xs">{a.identity_status}</p>
                </td>
                <td className="p-3">{a.channel}</td>
                <td>
                  <Button variant="outline" size="sm" onClick={() => setSelected(a.id)}>
                    View details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a && (
        <section className="space-y-3 border-t pt-5">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">{a.full_name}</h2>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(a.details as Record<string, unknown>).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                <dd className="break-words text-sm">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
          <h3 className="font-semibold">Sample documents</h3>
          {Object.entries(a.documents as Record<string, unknown>).map(([name, v]) => {
            const d = v as { name?: string; type?: string; data?: string };
            return (
              <div key={name} className="flex flex-wrap items-center gap-3">
                <span>
                  {name}: {d.name || String(v)}
                </span>
                {d.data && d.type && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const bytes = Uint8Array.from(atob(d.data || ""), (c) => c.charCodeAt(0));
                      save(
                        new Blob([bytes], { type: d.type ?? "application/octet-stream" }),
                        d.name || "sample-document",
                      );
                    }}
                  >
                    Download document
                  </Button>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
