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
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      setError("Unable to copy the verification code on this device.");
    }
  }

  return (
    <main className="certificate-page mx-auto min-h-screen w-full max-w-5xl px-3 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <a href="/learn" className="text-sm font-semibold text-primary">NEXORA Academy</a>
        <div className="flex flex-wrap justify-end gap-2">
          {certificate && <Button size="sm" variant="outline" onClick={() => void copyCode()}><Copy className="mr-2 h-4 w-4" />Copy verification link</Button>}
          {certificate && <Button size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / Save PDF</Button>}
        </div>
      </div>
      {loading ? (
        <div className="rounded-3xl border p-10 text-center text-muted-foreground">Verifying certificate…</div>
      ) : certificate ? (
        <article className="certificate-sheet relative mx-auto flex flex-col items-center justify-between overflow-hidden bg-white text-center text-slate-900 shadow-2xl">
          <div className="certificate-frame pointer-events-none absolute inset-[7mm] border border-amber-500/80" />
          <div className="certificate-frame-inner pointer-events-none absolute inset-[9mm] border border-indigo-300/80" />
          <div className="certificate-corner certificate-corner-tl" />
          <div className="certificate-corner certificate-corner-tr" />
          <div className="certificate-corner certificate-corner-bl" />
          <div className="certificate-corner certificate-corner-br" />

          <div className="relative z-10 flex w-full flex-col items-center">
            <div className="nexora-emblem grid place-items-center rounded-2xl text-white shadow-lg">
              <span className="font-display text-4xl font-black tracking-tight">N</span>
            </div>
            <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.42em] text-indigo-800">NEXORA ACADEMY</p>
            <div className="mt-2 h-px w-28 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
            <h1 className="mt-3 font-display text-3xl font-bold tracking-wide text-slate-900">Certificate of Completion</h1>
            <p className="mt-3 text-sm tracking-wide text-slate-600">THIS CERTIFICATE IS PROUDLY PRESENTED TO</p>
            <p className="certificate-learner mt-2 max-w-[85%] break-words font-display text-4xl font-bold text-indigo-950">{certificate.learnerName}</p>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">For successfully completing all published lessons in</p>
            <h2 className="mt-2 max-w-[85%] break-words text-2xl font-semibold text-slate-900">{certificate.courseTitle}</h2>
            <p className="mt-3 text-sm text-slate-600">Instructor: <span className="font-semibold text-slate-900">{certificate.instructorName}</span></p>
          </div>

          <div className="relative z-10 flex w-full items-end justify-between gap-5 px-[12mm] pb-[4mm]">
            <div className="min-w-0 flex-1 text-left">
              <div className="mb-2 h-px w-full bg-gradient-to-r from-indigo-300 via-amber-400 to-transparent" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Date issued</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{new Date(certificate.issuedAt).toLocaleDateString()}</p>
              <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Verification code</p>
              <p className="mt-1 break-all font-mono text-[10px] font-semibold text-slate-700">{certificate.verificationCode}</p>
            </div>
            <div className="nexora-signature shrink-0 text-center">
              <p className="font-serif text-3xl italic leading-none text-indigo-900">Nexora</p>
              <div className="mx-auto mt-1 h-px w-28 bg-indigo-400" />
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Nexora Academy</p>
              <p className="mt-1 text-[8px] text-slate-500">Digital signature mark</p>
            </div>
            <div className="nexora-seal flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-double border-amber-600 text-center text-amber-800">
              <ShieldCheck className="h-6 w-6" />
              <span className="mt-1 text-[8px] font-black uppercase tracking-[0.12em]">Nexora Academy</span>
              <span className="text-[9px] font-black uppercase tracking-[0.16em]">Verified</span>
              <span className="mt-1 text-[7px] font-semibold">AUTHENTIC</span>
            </div>
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
      <style>{`
        .nexora-emblem { width: 58px; height: 58px; background: linear-gradient(135deg, #2563eb 0%, #6d28d9 55%, #9333ea 100%); }
        .certificate-corner { position: absolute; z-index: 2; width: 18mm; height: 18mm; border-color: #c18b2d; border-style: solid; }
        .certificate-corner-tl { top: 5mm; left: 5mm; border-width: 2px 0 0 2px; }
        .certificate-corner-tr { top: 5mm; right: 5mm; border-width: 2px 2px 0 0; }
        .certificate-corner-bl { bottom: 5mm; left: 5mm; border-width: 0 0 2px 2px; }
        .certificate-corner-br { bottom: 5mm; right: 5mm; border-width: 0 2px 2px 0; }
        @media screen {
          .certificate-sheet { width: min(100%, 1120px); min-height: 760px; padding: 52px 48px 36px; border: 5px double #c18b2d; border-radius: 12px; }
        }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body, #root { width: 297mm !important; height: 210mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .certificate-page { width: 297mm !important; max-width: none !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; }
          .certificate-sheet { width: 297mm !important; height: 210mm !important; min-height: 0 !important; max-height: 210mm !important; padding: 15mm 18mm 11mm !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; break-after: avoid !important; page-break-after: avoid !important; overflow: hidden !important; }
          .certificate-learner { font-size: 30pt !important; }
          .certificate-frame, .certificate-frame-inner, .certificate-corner { position: absolute !important; }
          .nexora-seal { width: 24mm !important; height: 24mm !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </main>
  );
}
