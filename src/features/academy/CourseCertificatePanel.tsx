import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Award, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  hasLearnerDisplayName,
  issueCourseCertificate,
  listMyCourseCertificates,
  type CourseCertificate,
} from "./courseCertificates";

type CourseCertificatePanelProps = {
  courseId: string;
  canIssue: boolean;
};

export function CourseCertificatePanel({ courseId, canIssue }: CourseCertificatePanelProps) {
  const { user } = useSession();
  const [certificate, setCertificate] = useState<CourseCertificate | null>(null);
  const [hasProfileName, setHasProfileName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCertificate = useCallback(async () => {
    setLoading(true);
    if (!user) {
      setCertificate(null);
      setHasProfileName(false);
      setLoading(false);
      return;
    }

    const [certificatesResult, profileResult] = await Promise.all([
      listMyCourseCertificates(),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    ]);

    if (certificatesResult.error) setError(certificatesResult.error.message);
    else setCertificate(certificatesResult.data.find((item) => item.courseId === courseId) ?? null);

    if (profileResult.error) {
      setError("Could not check your profile name. Please try again.");
      setHasProfileName(false);
    } else {
      setHasProfileName(hasLearnerDisplayName(profileResult.data?.display_name));
    }
    setLoading(false);
  }, [courseId, user?.id]);

  useEffect(() => {
    void loadCertificate();
  }, [loadCertificate]);

  async function handleIssue() {
    if (!canIssue || !hasProfileName || issuing) return;
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
        <>
          {!hasProfileName && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              Add your full display name before issuing a certificate. <Link to="/profile-settings" className="font-semibold underline">Update profile</Link>
            </p>
          )}
          <Button type="button" size="sm" className="mt-3 w-full" disabled={!canIssue || !hasProfileName || issuing} onClick={() => void handleIssue()}>
            {issuing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Issuing…</> : "Issue certificate"}
          </Button>
        </>
      )}
      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
