import { toast } from "sonner";
import { Camera, Copy, Download, Facebook, MessageCircle, Music2, Send, Share2, Twitter } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  caption: string;
  /** Public link to the video or image, when the post has one. */
  mediaUrl?: string;
  /** Called once when the person really shares. The app counts it only once per post. */
  onShared: () => void;
};

function Tile({ label, onClick, className, children }: { label: string; onClick: () => void; className: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 text-xs">
      <span className={`grid h-12 w-12 place-items-center rounded-full text-white ${className}`}>{children}</span>
      {label}
    </button>
  );
}

const extensionOf = (url: string, fallback: string) =>
  /\.([a-z0-9]{2,5})(?:$|\?)/i.exec(url)?.[1]?.toLowerCase() ?? fallback;

async function fetchMediaFile(postId: string, url: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download failed");
  const blob = await res.blob();
  const ext = extensionOf(url, blob.type.startsWith("video/") ? "mp4" : "jpg");
  return new File([blob], `nexora-${postId}.${ext}`, { type: blob.type });
}

export function ShareSheet({ open, onOpenChange, postId, caption, mediaUrl, onShared }: Props) {
  const link = typeof window !== "undefined" ? `${window.location.origin}/?post=${postId}` : "";
  const text = caption.trim() ? `${caption.trim().slice(0, 120)} — on NEXORA` : "Watch this on NEXORA";

  const done = () => {
    onShared();
    onOpenChange(false);
  };
  const open_ = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    done();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
      done();
    } catch {
      toast.error("Could not copy the link. Copy it from the address bar instead.");
    }
  };

  // Instagram and TikTok have no web share link, so open the phone's share sheet. It lists
  // those apps when they are installed. If the phone cannot do that, copy the link instead.
  const viaPhone = async (app: "Instagram" | "TikTok") => {
    try {
      if (navigator.share) {
        if (mediaUrl) {
          try {
            const file = await fetchMediaFile(postId, mediaUrl);
            if (navigator.canShare?.({ files: [file] })) {
              await navigator.share({ files: [file], text });
              return done();
            }
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
          }
        }
        await navigator.share({ text, url: link });
        return done();
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`Link copied. Paste it in ${app}.`);
      done();
    } catch {
      toast.error(`Could not open ${app}. Use Copy link instead.`);
    }
  };

  const more = async () => {
    try {
      await navigator.share({ title: "NEXORA", text, url: link });
      done();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast.error("Sharing is not available here.");
    }
  };

  const download = async () => {
    if (!mediaUrl) return;
    try {
      const file = await fetchMediaFile(postId, mediaUrl);
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success("Download started");
    } catch {
      window.open(mediaUrl, "_blank", "noopener,noreferrer");
      toast("Opened the file. Long-press it to save.");
    }
  };

  const enc = encodeURIComponent;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Share</DialogTitle>
        <div className="grid grid-cols-4 gap-4 pt-2">
          <Tile label="WhatsApp" className="bg-[#25D366]" onClick={() => open_(`https://wa.me/?text=${enc(`${text} ${link}`)}`)}>
            <MessageCircle className="h-6 w-6" />
          </Tile>
          <Tile label="Instagram" className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" onClick={() => void viaPhone("Instagram")}>
            <Camera className="h-6 w-6" />
          </Tile>
          <Tile label="TikTok" className="bg-black" onClick={() => void viaPhone("TikTok")}>
            <Music2 className="h-6 w-6" />
          </Tile>
          <Tile label="Facebook" className="bg-[#1877F2]" onClick={() => open_(`https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`)}>
            <Facebook className="h-6 w-6" />
          </Tile>
          <Tile label="X" className="bg-neutral-800" onClick={() => open_(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(link)}`)}>
            <Twitter className="h-6 w-6" />
          </Tile>
          <Tile label="Telegram" className="bg-[#229ED9]" onClick={() => open_(`https://t.me/share/url?url=${enc(link)}&text=${enc(text)}`)}>
            <Send className="h-6 w-6" />
          </Tile>
          <Tile label="Copy link" className="bg-muted-foreground" onClick={() => void copy()}>
            <Copy className="h-6 w-6" />
          </Tile>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Tile label="More" className="bg-primary" onClick={() => void more()}>
              <Share2 className="h-6 w-6" />
            </Tile>
          )}
          {mediaUrl && (
            <Tile label="Download" className="bg-emerald-600" onClick={() => void download()}>
              <Download className="h-6 w-6" />
            </Tile>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
