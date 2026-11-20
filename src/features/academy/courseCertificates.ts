import { supabase } from "@/integrations/supabase/client";

export type CourseCertificate = {
  id: string;
  courseId: string;
  studentId: string;
  learnerName: string;
  courseTitle: string;
  instructorName: string;
  verificationCode: string;
  issuedAt: string;
};

type CertificateRow = {
  id: string;
  course_id: string;
  student_id: string;
  learner_name: string;
  course_title: string;
  instructor_name: string;
  verification_code: string;
  issued_at: string;
};

export type PublicCertificateVerification = Omit<CourseCertificate, "id" | "studentId"> & {
  isValid: boolean;
};

export function mapCourseCertificate(row: CertificateRow): CourseCertificate {
  return {
    id: row.id,
    courseId: row.course_id,
    studentId: row.student_id,
    learnerName: row.learner_name,
    courseTitle: row.course_title,
    instructorName: row.instructor_name,
    verificationCode: row.verification_code,
    issuedAt: row.issued_at,
  };
}

export function hasLearnerDisplayName(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && value.trim().toLowerCase() !== "learner";
}

export function isValidCertificateCode(value: string): boolean {
  return /^[a-f0-9]{32}$/i.test(value.trim());
}

export async function issueCourseCertificate(
  courseId: string,
): Promise<{ data: CourseCertificate | null; error: Error | null }> {
  const { data, error } = await (supabase as any).rpc(
    "issue_edu_course_certificate",
    { p_course_id: courseId },
  );
  if (error) return { data: null, error: new Error(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  return row
    ? { data: mapCourseCertificate(row as CertificateRow), error: null }
    : { data: null, error: new Error("The certificate could not be issued.") };
}

export async function listMyCourseCertificates(): Promise<{
  data: CourseCertificate[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("edu_course_certificates" as any)
    .select("id,course_id,student_id,learner_name,course_title,instructor_name,verification_code,issued_at")
    .order("issued_at", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: ((data ?? []) as CertificateRow[]).map(mapCourseCertificate),
    error: null,
  };
}

export async function verifyCourseCertificate(
  code: string,
): Promise<{ data: PublicCertificateVerification | null; error: Error | null }> {
  if (!isValidCertificateCode(code)) {
    return { data: null, error: new Error("Enter a valid certificate verification code.") };
  }
  const { data, error } = await (supabase as any).rpc(
    "verify_edu_course_certificate",
    { p_verification_code: code.trim().toLowerCase() },
  );
  if (error) return { data: null, error: new Error(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: null, error: new Error("No certificate matches this verification code.") };
  return {
    data: {
      learnerName: row.learner_name,
      courseTitle: row.course_title,
      instructorName: row.instructor_name,
      issuedAt: row.issued_at,
      verificationCode: row.verification_code,
      isValid: Boolean(row.is_valid),
    },
    error: null,
  };
}
