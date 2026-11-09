import type { ReactNode } from "react";
import {
  Briefcase,
  Building2,
  Code,
  GraduationCap,
  Music,
  Palette,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";

interface ProfileBadgesProps {
  accountType: "personal" | "creator" | "business";
  industryTag: string;
  isVerified?: boolean;
}

const CATEGORY_ICONS: Record<string, ReactNode> = {
  "Tech & Gaming": <Code className="mr-1 h-3.5 w-3.5 text-cyan-400" />,
  "Sports & Health": <Trophy className="mr-1 h-3.5 w-3.5 text-emerald-400" />,
  "Arts & Creative": <Palette className="mr-1 h-3.5 w-3.5 text-pink-400" />,
  "Business / Sales": <Briefcase className="mr-1 h-3.5 w-3.5 text-amber-400" />,
  "Music & Audio": <Music className="mr-1 h-3.5 w-3.5 text-purple-400" />,
  "Education & Lifestyle": <GraduationCap className="mr-1 h-3.5 w-3.5 text-blue-400" />,
};

export function ProfileBadges({ accountType, industryTag, isVerified = false }: ProfileBadgesProps) {
  return (
    <div className="my-2 flex flex-wrap items-center gap-2">
      {accountType === "creator" && (
        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
          <Sparkles className="mr-1 h-3 w-3" /> Creator
        </span>
      )}
      {accountType === "business" && (
        <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
          <Building2 className="mr-1 h-3 w-3" /> Business
        </span>
      )}
      {accountType === "personal" && (
        <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300">
          <User className="mr-1 h-3 w-3" /> Personal
        </span>
      )}
      {industryTag && (
        <span className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-slate-300">
          {CATEGORY_ICONS[industryTag]}
          {industryTag}
        </span>
      )}
      {isVerified && <ShieldCheck className="h-4 w-4 text-sky-400" aria-label="Verified account" title="Verified account" />}
    </div>
  );
}
