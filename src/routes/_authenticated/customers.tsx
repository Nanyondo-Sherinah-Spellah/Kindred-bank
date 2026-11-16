import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Loading, PageHeader, StatusPill } from "@/components/common";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customer Records — Kindred Bank" }, { name: "description", content: "Fictional demonstration customer records." }, { property: "og:title", content: "Customer Records — Kindred Bank" }, { property: "og:description", content: "Fictional demonstration customer records." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      // Verification codes are not selectable from the browser; they are checked only on the server.
      const { data, error } = await supabase.from("customers").select("id, full_name, email, phone_number, next_repayment_date, repayment_amount, loan_status, created_at").order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const list = (data ?? []).filter((c) => !q || `${c.full_name} ${c.email} ${c.phone_number}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Customer Records" description="Fictional demonstration customers only. Never load real customer data into this demo." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input className="max-w-sm" placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Verification codes are hidden and checked server-side only.</span>
      </div>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-4"><Loading /></div> : list.length === 0 ? <div className="p-4"><EmptyState title="No customers found" /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Next repayment</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Loan status</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone_number}</TableCell>
                  <TableCell>{c.next_repayment_date ? new Date(c.next_repayment_date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">UGX {Number(c.repayment_amount ?? 0).toLocaleString("en-US")}</TableCell>
                  <TableCell><StatusPill label={c.loan_status} kind="info" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </>
  );
}
