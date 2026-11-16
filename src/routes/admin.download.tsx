import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CHANNEL_LABEL, ticketsQuery } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/download")({
  head: () => ({
    meta: [
      { title: "Download data — Kindred Bank Admin" },
      { name: "description", content: "Export customer service tickets as PDF, Excel or CSV." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Download data — Kindred Bank Admin" },
      { property: "og:description", content: "Export customer service tickets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DownloadPage,
});

const HEAD = ["Date", "Case", "Channel", "Category", "Priority", "Status", "Assigned to", "Customer", "Description"];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function DownloadPage() {
  const { data, isLoading } = useQuery(ticketsQuery);
  const rows = (data ?? []).map((t) => [
    new Date(t.created_at).toLocaleString("en-GB"),
    t.case_reference ?? "",
    CHANNEL_LABEL[t.channel] ?? t.channel,
    t.issue_category,
    t.priority,
    t.status,
    t.assigned_to ?? "",
    t.customer_email ?? "",
    t.description,
  ]);
  const stamp = new Date().toISOString().slice(0, 10);

  function csv() {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const text = [HEAD, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    downloadBlob(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }), `kindred-tickets-${stamp}.csv`);
  }
  async function excel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([HEAD, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tickets");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `kindred-tickets-${stamp}.xlsx`);
  }
  async function pdf() {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Kindred Bank — Customer service tickets (${stamp})`, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [HEAD],
      body: rows.map((r) => [...r.slice(0, 8), (r[8] ?? "").slice(0, 200)]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [122, 40, 46] },
      columnStyles: { 8: { cellWidth: 80 } },
    });
    downloadBlob(doc.output("blob"), `kindred-tickets-${stamp}.pdf`);
  }
  async function run(fn: () => void | Promise<void>) {
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Download failed"); }
  }

  const items = [
    { label: "PDF", hint: "Printable report", icon: FileText, fn: pdf },
    { label: "Excel", hint: "Spreadsheet (.xlsx)", icon: FileSpreadsheet, fn: excel },
    { label: "CSV", hint: "Plain data file", icon: FileDown, fn: csv },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Download data</h1>
        <p className="text-sm text-muted-foreground">{isLoading ? "Loading tickets…" : `${rows.length} tickets from every channel.`}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((i) => (
          <Card key={i.label}>
            <CardContent className="flex flex-col items-start gap-3 p-5">
              <i.icon className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">{i.label}</p>
                <p className="text-sm text-muted-foreground">{i.hint}</p>
              </div>
              <Button className="w-full" disabled={isLoading || rows.length === 0} onClick={() => run(i.fn)}>Download {i.label}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
