import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { beginApplication, verifyApplication } from "@/lib/account-opening.functions";
import { applicationSchema, friendlyOpeningError, PRODUCTS } from "@/lib/account-opening";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { openingText, OPENING_LANGS, OPENING_SPEECH_LOCALE, type OpeningLang } from "@/lib/account-opening-i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
const fields = [
  ["full_name", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["dob", "Date of birth"],
  ["bvn", "Fictional BVN"],
  ["nin", "Fictional NIN"],
  ["id_type", "Government ID type"],
  ["id_number", "ID number"],
  ["birthplace", "Place of birth"],
  ["address", "Residential address"],
  ["occupation", "Occupation"],
  ["employer", "Employer or business"],
  ["source_of_funds", "Source of funds"],
  ["monthly_income", "Monthly income (NGN)"],
  ["next_of_kin", "Next of kin, relationship and phone"],
] as const;
export function AccountOpeningForm({ channel = "chat", initialProduct }: { channel?: "voice" | "chat" | "email"; initialProduct?: string }) {
  const begin = useServerFn(beginApplication),
    verify = useServerFn(verifyApplication);
  const [values, setValues] = useState<Record<string, string>>({
    gender: "Female",
    monthly_income: "0",
    deposit: "0",
  });
  const [product, setProduct] = useState<string>(initialProduct ?? "Everyday Savings");
  const [kids, setKids] = useState(false);
  const [documents, setDocuments] = useState<
    Record<
      string,
      { name: string; type: "application/pdf" | "image/jpeg" | "image/png"; data: string }
    >
  >({});
  const [fictional, setFictional] = useState(false),
    [simulated, setSimulated] = useState(false);
  const [pending, setPending] = useState<{ id: string; token: string; reference?: string; simulatedCode?: string | null } | null>(null);
  const [result, setResult] = useState<{ accounts?: { account_number: string; product: string; holder: string }[]; verification_code?: string; reference?: string; emailed: boolean | null; email?: string } | null>(null);
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [lang, setLang] = useState<OpeningLang>("en");
  const t = openingText(lang);
  const speak = (s: string) => {
    if (channel === "voice" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(s);
      u.lang = OPENING_SPEECH_LOCALE[lang];
      window.speechSynthesis.speak(u);
    }
  };
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const input = applicationSchema.parse({
        ...values,
        phone: values["phone"],
        email: values["email"],
        fictional,
        simulated_email: simulated,
        channel,
        monthly_income: Number(values["monthly_income"]),
        accounts: [
          { product, deposit: Number(values["deposit"]), holder: values["full_name"] },
          ...(kids
            ? [
                {
                  product: "Kids Saver",
                  deposit: Number(values["child_deposit"] || 0),
                  holder: values["child_name"],
                },
              ]
            : []),
        ],
        documents,
      });
      const r = await begin({ data: input });
      setResult(r);
      speak("Your account is now open. Your account number and login details are shown on the screen.");
    } catch (e) {
      setError(friendlyOpeningError(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const r = await verify({ data: { id: pending.id, token: pending.token, code } });
      setResult(r);
      speak("Your accounts are now open in the banking simulation. Your account numbers are displayed below.");
    } catch (e) {
      setError(friendlyOpeningError(e));
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <section className="space-y-4" aria-label="Accounts opened">
        <h2 className="text-xl font-semibold text-primary">{t("opened")}</h2>
        <div className="rounded-xl border-2 border-primary bg-card p-5 shadow-sm space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Your new account details</p>
          {result.accounts?.map((a) => (
            <div key={a.account_number} className="border-b pb-3">
              <p className="font-semibold">{a.product} — {a.holder}</p>
              <p className="font-mono text-2xl tracking-wider text-primary">{a.account_number}</p>
            </div>
          ))}
          <p>Login (account number) <strong className="font-mono">{result.accounts?.[0]?.account_number}</strong></p>
          <p>{t("balance_code")} <strong className="font-mono text-lg">{result.verification_code}</strong></p>
          <p className="text-sm">{t("reference")}: {result.reference}</p>
        </div>
        <p role="status" className="rounded-md bg-secondary p-3 text-sm">
          {result.emailed === null
            ? "No email address was given, so please save these details from this screen."
            : result.emailed
            ? `These same details have been sent to your email address${result.email ? ` (${result.email})` : ""}.`
            : "We couldn't email your details right now — please save them from this screen."}
        </p>
        <p className="text-sm">{t("balance_help")}</p>
      </section>
    );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="opening-language">{t("language")}</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as OpeningLang)}>
            <SelectTrigger id="opening-language" className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPENING_LANGS.map(([v, l]) => (<SelectItem key={v} value={v}>{l}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      {pending ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <p>{t("reference")}: {pending.reference}</p>
          <p>
            {pending.simulatedCode
              ? `${t("simcode")} ${pending.simulatedCode}`
              : t("sent")}
          </p>
          <Label htmlFor="email-code">{t("code")}</Label>
          <Input
            id="email-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            inputMode="numeric"
            required
            pattern="[0-9]{6}"
          />
          <Button disabled={busy}>{busy ? t("checking") : t("verify")}</Button>
        </form>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([key]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`opening-${key}`}>{t(key)}</Label>
                <Input
                  id={`opening-${key}`}
                  required={key !== "email"}
                  placeholder={key === "email" ? "Optional" : undefined}
                  maxLength={250}
                  type={
                    key === "email"
                      ? "email"
                      : key === "dob"
                        ? "date"
                        : ["monthly_income"].includes(key)
                          ? "number"
                          : "text"
                  }
                  value={values[key] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>{t("gender")}</Label>
              <Select
                value={values["gender"] ?? "Female"}
                onValueChange={(v) => setValues((x) => ({ ...x, gender: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Female", "Male", "Other"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("account_type")}</Label>
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTS.filter((p) => p !== "Kids Saver").map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="opening-deposit">{t("deposit")}</Label>
              <Input
                id="opening-deposit"
                type="number"
                min="0"
                required
                value={values["deposit"]}
                onChange={(e) => setValues((v) => ({ ...v, deposit: e.target.value }))}
              />
            </div>
          </div>
          {product === "Current Account" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["tax_id", "Tax Identification Number"],
                  ["referees", "Bank referees and phone numbers"],
                ] as const
              ).map(([key]) => (
                <div key={key}>
                  <Label htmlFor={key}>{t(key)}</Label>
                  <Input
                    id={key}
                    required
                    value={values[key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
          <Label className="flex items-center gap-2">
            <input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} />
            {t("kids")}
          </Label>
          {kids && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["child_name", "Child name", "text"],
                  ["child_dob", "Child date of birth", "date"],
                  ["child_deposit", "Child fictional opening deposit (NGN)", "number"],
                ] as const
              ).map(([key, , type]) => (
                <div key={key}>
                  <Label htmlFor={key}>{t(key)}</Label>
                  <Input
                    id={key}
                    type={type}
                    required
                    value={values[key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {t("guardian")}
              </p>
            </div>
          )}
          <h3 className="font-semibold">{t("docs")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Government ID",
              "Passport photograph",
              "Signature",
              "Proof of address",
              ...(kids ? ["Birth certificate"] : []),
            ].map((name) => (
              <div key={name} className="space-y-1">
                <Label>{t(name)}</Label>
                <Input
                  aria-label={t(name)}
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  required
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1000000) {
                      setError(t("too_big"));
                      e.target.value = "";
                      return;
                    }
                    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
                      setError(t("bad_type"));
                      return;
                    }
                    const data = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });
                    setDocuments((d) => ({
                      ...d,
                      [name]: {
                        name: file.name,
                        type: file.type as "application/pdf" | "image/jpeg" | "image/png",
                        data,
                      },
                    }));
                  }}
                />
              </div>
            ))}
          </div>
          <Label className="flex items-start gap-2">
            <input
              type="checkbox"
              required
              checked={fictional}
              onChange={(e) => setFictional(e.target.checked)}
            />
            {t("confirm")}
          </Label>
          <Label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={simulated}
              onChange={(e) => setSimulated(e.target.checked)}
            />
            {t("simulate")}
          </Label>
          <Button disabled={busy || !fictional}>
            {busy ? t("saving") : t("send")}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="break-words whitespace-pre-wrap text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
