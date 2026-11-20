import { useCallback, useEffect, useState } from "react";
import { Award, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  issueCourseCertificate,
  listMyCourseCertificates,
  type CourseCertificate,
} from "./courseCertificates";

type CourseCertificatePanelProps = {
  courseId: string;
  canIssue: boolean;
};

export function CourseCertificatePanel({ courseId, canIssue }: CourseCertificatePanelProps) {
  const [certificate, setCertificate] = useState<CourseCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCertificate = useCallback(async () => {
    setLoading(true);
    const result = await listMyCourseCertificates();
    if (result.error) setError(result.error.message);
    else setCertificate(result.data.find((item) => item.courseId === courseId) ?? null);
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    void loadCertificate();
  }, [loadCertificate]);

  async function handleIssue() {
    if (!canIssue || issuing) return;
    setIssuing(true);
    setError(null);
    const result = await issueCourseCertificate(courseId);
    if (result.error) {
      setError(result.error.message);
      setIssuing(false);
      return;
    }
    setCertificate(result.data);
    toast.success("Your course certificate is ready.");
    setIssuing(false);
  }

  function openCertificate() {
    if (!certificate) return;
    window.location.assign(`/certificate/${certificate.verificationCode}`);
  }

  if (loading) {
    return <p className="mt-3 text-xs text-muted-foreground">Checking certificate…</p>;
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Course certificate</p>
          <p className="text-xs text-muted-foreground">
            {certificate ? "Your verified completion certificate is ready." : "Complete every published lesson to earn your certificate."}
          </p>
        </div>
      </div>
      {certificate ? (
        <Button type="button" size="sm" className="mt-3 w-full" onClick={openCertificate}>
          View certificate <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <Button type="button" size="sm" className="mt-3 w-full" disabled={!canIssue || issuing} onClick={() => void handleIssue()}>
          {issuing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Issuing…</> : "Issue certificate"}
        </Button>
      )}
      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
