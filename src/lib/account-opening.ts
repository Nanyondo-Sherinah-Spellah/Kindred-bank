import { z } from "zod";
export const PRODUCTS = ["Everyday Savings", "Current Account", "Goal Saver", "Fixed Deposit", "Kids Saver"] as const;
/** Product named in an upsell offer that can be opened through the self-service form. */
export function offeredOpenableProduct(text: string | undefined) {
  const m = text?.match(/You may also like: (Goal Saver|Fixed Deposit)\b/);
  return m ? (m[1] as "Goal Saver" | "Fixed Deposit") : null;
}
export const isOpeningRequest = (text: string) =>
  /\b(open|create|register|apply for|start)\b.{0,45}\b(bank account|savings account|current account|kids saver|an? account)\b/i.test(
    text,
  );
const text = z.string().trim().min(1).max(250);
export const applicationSchema = z
  .object({
    full_name: text,
    email: z.union([z.email().max(255), z.literal("")]).default("").transform((s) => s.toLowerCase()),
    phone: z.string().regex(/^\+?[\d ]{7,20}$/),
    channel: z.enum(["voice", "chat", "email"]).default("chat"),
    fictional: z.literal(true),
    simulated_email: z.boolean().default(false),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: z.enum(["Female", "Male", "Other"]),
    bvn: z.string().regex(/^\d{11}$/),
    nin: z.string().regex(/^\d{11}$/),
    id_type: text,
    id_number: text,
    birthplace: text,
    address: text,
    occupation: text,
    employer: text,
    source_of_funds: text,
    monthly_income: z.number().min(0).max(1000000000),
    next_of_kin: text,
    tax_id: z.string().max(100).default(""),
    referees: z.string().max(1000).default(""),
    child_name: z.string().max(200).default(""),
    child_dob: z.string().max(10).default(""),
    accounts: z
      .array(
        z.object({
          product: z.enum(PRODUCTS),
          deposit: z.number().min(0).max(1000000000),
          holder: z.string().max(200).default(""),
        }),
      )
      .min(1)
      .max(2),
    documents: z.record(
      z.string(),
      z.object({
        name: text,
        type: z.enum(["application/pdf", "image/jpeg", "image/png"]),
        data: z.string().min(1).max(1333336).regex(/^[A-Za-z0-9+/]+={0,2}$/),
      }),
    ),
  })
  .superRefine((d, ctx) => {
    if (Object.keys(d.documents).length > 5) ctx.addIssue({ code: "custom", message: "Upload only the requested sample documents." });
    for (const document of Object.values(d.documents)) {
      const expected = document.type === "application/pdf" ? "JVBERi0" : document.type === "image/png" ? "iVBORw0KGgo" : "/9j/";
      if (!document.data.startsWith(expected)) ctx.addIssue({ code: "custom", message: "The document content does not match its file type." });
    }
    const products = d.accounts.map((a) => a.product);
    if (new Set(products).size !== products.length)
      ctx.addIssue({ code: "custom", message: "Choose each product only once." });
    for (const key of [
      "Government ID",
      "Passport photograph",
      "Signature",
      "Proof of address",
      ...(products.includes("Kids Saver") ? ["Birth certificate"] : []),
    ])
      if (!d.documents[key]) ctx.addIssue({ code: "custom", message: `Upload ${key}.` });
    if (
      products.includes("Kids Saver") &&
      (!d.child_name || !/^\d{4}-\d{2}-\d{2}$/.test(d.child_dob))
    )
      ctx.addIssue({ code: "custom", message: "Child name and birth date are required." });
    if (products.includes("Current Account") && (!d.tax_id || !d.referees))
      ctx.addIssue({ code: "custom", message: "Current Account requires a tax ID and referees." });
  });
export type ApplicationInput = z.infer<typeof applicationSchema>;

const FIELD_LABELS: Record<string, string> = { full_name: "Full name", email: "Email", phone: "Phone number", dob: "Date of birth", gender: "Gender", bvn: "BVN (11 digits)", nin: "NIN (11 digits)", id_type: "ID type", id_number: "ID number", birthplace: "Place of birth", address: "Address", occupation: "Occupation", employer: "Employer", source_of_funds: "Source of funds", monthly_income: "Monthly income", next_of_kin: "Next of kin", fictional: "Confirmation checkbox", accounts: "Opening deposit" };
/** Turns validation errors (which arrive as JSON) into plain sentences for customers. */
export function friendlyOpeningError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  let issues: { path?: (string | number)[]; message?: string }[] | null = null;
  if (e && typeof e === "object" && "issues" in e && Array.isArray((e as { issues: unknown }).issues)) issues = (e as { issues: typeof issues }).issues;
  else { try { const j = JSON.parse(raw); if (Array.isArray(j)) issues = j; } catch { /* plain message */ } }
  if (!issues) return raw || "Could not submit. Please check your details and try again.";
  const lines = issues.slice(0, 5).map((i) => {
    const key = String(i.path?.[0] ?? "");
    const label = FIELD_LABELS[key];
    if (label && (!i.message || /^(Invalid|Too small|Too big|Expected)/i.test(i.message))) return `Please check: ${label}.`;
    return label ? `${label}: ${i.message}` : (i.message ?? "Please check your details.");
  });
  return Array.from(new Set(lines)).join(" ");
}
