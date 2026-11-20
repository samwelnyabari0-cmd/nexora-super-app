import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, CheckCircle2, Copy, Printer, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyCourseCertificate, type PublicCertificateVerification } from "@/features/academy/courseCertificates";

export const Route = createFileRoute("/certificate/$code")({
  head: () => ({ meta: [{ title: "Certificate Verification — NEXORA" }] }),
  component: CertificateVerificationPage,
});

function CertificateVerificationPage() {
  const { code } = Route.useParams();
  const [certificate, setCertificate] = useState<PublicCertificateVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void verifyCourseCertificate(code).then((result) => {
      if (!active) return;
      setCertificate(result.data);
      setError(result.error?.message ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [code]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      setError("Unable to copy the verification code on this device.");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <a href="/learn" className="text-sm font-semibold text-primary">NEXORA Academy</a>
        <div className="flex gap-2">
          {certificate && <Button size="sm" variant="outline" onClick={() => void copyCode()}><Copy className="mr-2 h-4 w-4" />Copy code</Button>}
          {certificate && <Button size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / Save PDF</Button>}
        </div>
      </div>
      {loading ? (
        <div className="rounded-3xl border p-10 text-center text-muted-foreground">Verifying certificate…</div>
      ) : certificate ? (
        <article className="certificate-print relative overflow-hidden rounded-3xl border-4 border-double border-amber-500/60 bg-card p-6 text-center shadow-xl sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-amber-400/50 bg-amber-400/10">
            <Award className="h-9 w-9 text-amber-400" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-amber-500">NEXORA ACADEMY</p>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-5xl">Certificate of Completion</h1>
          <p className="mx-auto mt-6 max-w-xl text-muted-foreground">This certificate is proudly presented to</p>
          <p className="mt-3 break-words text-2xl font-bold sm:text-4xl">{certificate.learnerName}</p>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">for successfully completing all published lessons in</p>
          <h2 className="mt-3 text-xl font-semibold sm:text-2xl">{certificate.courseTitle}</h2>
          <p className="mt-5 text-sm text-muted-foreground">Instructor: <span className="font-semibold text-foreground">{certificate.instructorName}</span></p>
          <div className="mx-auto mt-10 grid max-w-xl gap-4 border-t pt-5 text-sm sm:grid-cols-2">
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Date issued</p><p className="mt-1 font-semibold">{new Date(certificate.issuedAt).toLocaleDateString()}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Verification code</p><p className="mt-1 break-all font-mono text-xs font-semibold">{certificate.verificationCode}</p></div>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-500">
            <ShieldCheck className="h-5 w-5" /> Verified certificate
          </div>
        </article>
      ) : (
        <div className="rounded-3xl border p-10 text-center">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-xl font-bold">Certificate not verified</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "This certificate code is not valid."}</p>
          <Button className="mt-5" variant="outline" onClick={() => { window.location.href = "/learn"; }}>Return to Academy</Button>
        </div>
      )}
      {certificate && <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground print:hidden"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Verification confirms this certificate was issued by Nexora Academy.</p>}
      <style>{`@media print { @page { size: landscape; margin: 12mm; } body { background: white !important; } .certificate-print { box-shadow: none !important; break-inside: avoid; } }`}</style>
    </main>
  );
}
