import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Camera, FileCheck2, Gift, Radio, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createKycUploadUrls, completeKycUpload } from "@/lib/kyc-r2.functions";

const categories = ["Tech & Gaming", "Sports & Health", "Arts & Creative", "Business / Sales", "Music & Audio", "Education & Lifestyle"];
type Side = "front" | "back";
type KycStatus = "unverified" | "pending" | "verified";
type SelectedFiles = Record<Side, File | null>;
type Previews = Record<Side, string | null>;

export function PlatformSafetyControls() {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [docType, setDocType] = useState("national_id");
  const [files, setFiles] = useState<SelectedFiles>({ front: null, back: null });
  const [previews, setPreviews] = useState<Previews>({ front: null, back: null });
  const [isUploading, setIsUploading] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatus>("unverified");
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const createUploadUrls = useServerFn(createKycUploadUrls);
  const completeUpload = useServerFn(completeKycUpload);

  useEffect(() => () => {
    Object.values(previews).forEach((preview) => preview && URL.revokeObjectURL(preview));
  }, [previews]);

  function selectFile(file: File | undefined, side: Side) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0) {
      toast.error("Choose a PNG, JPG, or WEBP image up to 10 MB.");
      return;
    }
    setPreviews((current) => {
      if (current[side]) URL.revokeObjectURL(current[side]!);
      return { ...current, [side]: URL.createObjectURL(file) };
    });
    setFiles((current) => ({ ...current, [side]: file }));
  }

  function removeFile(side: Side) {
    setPreviews((current) => {
      if (current[side]) URL.revokeObjectURL(current[side]!);
      return { ...current, [side]: null };
    });
    setFiles((current) => ({ ...current, [side]: null }));
  }

  async function submitKyc(event: React.FormEvent) {
    event.preventDefault();
    if (!files.front) {
      toast.error("Add the front of your document before submitting.");
      return;
    }

    setIsUploading(true);
    try {
      const signed = await createUploadUrls({
        data: {
          front: { contentType: files.front.type as "image/jpeg" | "image/png" | "image/webp", size: files.front.size },
          ...(files.back ? { back: { contentType: files.back.type as "image/jpeg" | "image/png" | "image/webp", size: files.back.size } } : {}),
        },
      });

      const putFile = async (uploadUrl: string, file: File, contentType: string) => {
        const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
        if (!response.ok) throw new Error("A document upload failed. Please try again.");
      };
      await putFile(signed.front.uploadUrl, files.front, signed.front.contentType);
      if (signed.back && files.back) await putFile(signed.back.uploadUrl, files.back, signed.back.contentType);

      await completeUpload({
        data: {
          frontKey: signed.front.key,
          backKey: signed.back?.key ?? null,
          documentType: docType as "national_id" | "passport" | "drivers_license",
          category: selectedCategory as (typeof categories)[number],
        },
      });
      setKycStatus("pending");
      setIsModalOpen(false);
      setFiles({ front: null, back: null });
      setPreviews({ front: null, back: null });
      toast.success("KYC documents uploaded securely for review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section aria-labelledby="platform-safety" className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Platform safety</p>
          <h3 id="platform-safety" className="mt-1 text-base font-semibold">Security, live access, and payout protection</h3>
        </div>
        <ShieldCheck className="h-5 w-5 text-emerald-300" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <article className="rounded-xl border bg-background/70 p-3">
          <div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-emerald-300" /><h4 className="text-sm font-semibold">KYC identity verification</h4></div>
          <p className="mt-2 text-xs text-muted-foreground">Government ID or passport approval is required before Tier A/B cash withdrawals.</p>
          {kycStatus === "unverified" && <Button type="button" size="sm" className="mt-3" onClick={() => setIsModalOpen(true)}><Upload /> Submit ID for review</Button>}
          {kycStatus === "pending" && <p className="mt-3 flex items-center gap-2 text-xs text-amber-300"><BadgeCheck className="h-4 w-4" /> Review pending</p>}
          {kycStatus === "verified" && <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300"><BadgeCheck className="h-4 w-4" /> Identity verified</p>}
        </article>
        <article className="rounded-xl border bg-background/70 p-3">
          <div className="flex items-center gap-2"><Radio className="h-4 w-4 text-violet-300" /><h4 className="text-sm font-semibold">Live stream eligibility</h4></div>
          <p className="mt-2 text-xs text-muted-foreground">Live access requires 1,000 followers and a verified phone. Streams use Cloudflare Stream with tier-based quality caps.</p>
        </article>
        <article className="rounded-xl border bg-background/70 p-3">
          <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-amber-300" /><h4 className="text-sm font-semibold">Nexora Gems gifting</h4></div>
          <p className="mt-2 text-xs text-muted-foreground">Virtual gifts use verified Paystack or M-Pesa micro-payments.</p>
        </article>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="kyc-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 id="kyc-title" className="font-bold">Upload document from device</h3>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setIsModalOpen(false)}><X /></Button>
            </div>
            <form onSubmit={submitKyc} className="space-y-4 pt-4">
              <label className="block text-xs font-medium">Document type
                <select value={docType} onChange={(event) => setDocType(event.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2.5 text-sm">
                  <option value="national_id">National ID Card</option>
                  <option value="passport">International Passport</option>
                  <option value="drivers_license">Driver&apos;s License</option>
                </select>
              </label>
              <label className="block text-xs font-medium">Verification category
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2.5 text-sm">
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <DocumentDrop side="front" file={files.front} preview={previews.front} inputRef={frontInputRef} onSelect={selectFile} onRemove={removeFile} />
                <DocumentDrop side="back" file={files.back} preview={previews.back} inputRef={backInputRef} onSelect={selectFile} onRemove={removeFile} optional={docType === "passport"} />
              </div>
              <p className="text-xs text-muted-foreground">Documents upload directly to private Cloudflare R2 using short-lived signed URLs. Supabase stores only the verification record and object keys.</p>
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!files.front || isUploading}>{isUploading ? "Uploading securely…" : "Submit for review"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function DocumentDrop({ side, file, preview, inputRef, onSelect, onRemove, optional }: {
  side: Side;
  file: File | null;
  preview: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (file: File | undefined, side: Side) => void;
  onRemove: (side: Side) => void;
  optional?: boolean;
}) {
  return (
    <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onSelect(event.dataTransfer.files[0], side); }}>
      <p className="mb-1.5 text-xs font-medium">{side === "front" ? "Front image" : "Back image"} {optional ? "(optional)" : <span className="text-rose-400">*</span>}</p>
      <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(event) => onSelect(event.target.files?.[0], side)} />
      {preview && file ? (
        <div className="relative overflow-hidden rounded-xl border">
          <img src={preview} alt={`${side} identity document preview`} className="h-28 w-full object-cover" />
          <button type="button" aria-label={`Remove ${side} document`} onClick={() => onRemove(side)} className="absolute right-1 top-1 rounded-full bg-rose-600 p-1 text-white"><X className="h-3 w-3" /></button>
          <p className="truncate px-2 py-1 text-[10px] text-muted-foreground">{file.name}</p>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground hover:border-primary">
          <span className="flex gap-2 text-primary"><Upload className="h-5 w-5" /><Camera className="h-5 w-5" /></span>
          <span>Choose file, take photo, or drag here</span>
          <span className="text-[10px]">PNG, JPG, WEBP · max 10 MB</span>
        </button>
      )}
    </div>
  );
}
