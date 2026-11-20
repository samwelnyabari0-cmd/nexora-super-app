import { describe, expect, it } from "vitest";
import { isValidCertificateCode, mapCourseCertificate } from "./courseCertificates";

describe("course certificate helpers", () => {
  it("accepts a 32-character hexadecimal verification code", () => {
    expect(isValidCertificateCode("0123456789abcdef0123456789ABCDEF")).toBe(true);
  });

  it("rejects malformed verification codes", () => {
    expect(isValidCertificateCode("not-a-code")).toBe(false);
    expect(isValidCertificateCode("012345")).toBe(false);
    expect(isValidCertificateCode("g".repeat(32))).toBe(false);
  });

  it("maps a database certificate row to the UI model", () => {
    expect(mapCourseCertificate({
      id: "certificate-id",
      course_id: "course-id",
      student_id: "student-id",
      learner_name: "Learner One",
      course_title: "Intro to Design",
      instructor_name: "Instructor One",
      verification_code: "0123456789abcdef0123456789abcdef",
      issued_at: "2026-11-20T10:00:00.000Z",
    })).toEqual({
      id: "certificate-id",
      courseId: "course-id",
      studentId: "student-id",
      learnerName: "Learner One",
      courseTitle: "Intro to Design",
      instructorName: "Instructor One",
      verificationCode: "0123456789abcdef0123456789abcdef",
      issuedAt: "2026-11-20T10:00:00.000Z",
    });
  });
});
