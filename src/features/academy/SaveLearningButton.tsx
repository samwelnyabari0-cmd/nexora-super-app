import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  saveLearningItem,
  unsaveLearningItem,
  type SavedItemType,
} from "./savedLearning";

const referenceColumn = {
  course: "course_id",
  lesson: "lesson_id",
  resource: "resource_id",
  educator: "educator_id",
} as const;

export function SaveLearningButton({
  itemType,
  itemId,
  className,
  size = "icon",
}: {
  itemType: SavedItemType;
  itemId: string;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
}) {
  const { user } = useSession();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }
    let active = true;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("edu_saved_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("item_type", itemType)
        .eq(referenceColumn[itemType], itemId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Saved learning lookup failed:", error);
        return;
      }
      setSaved(Boolean(data));
    })();
    return () => {
      active = false;
    };
  }, [user?.id, itemType, itemId]);

  async function toggle() {
    if (!user) {
      toast.error("Sign in to save learning items.");
      return;
    }
    setLoading(true);
    const result = saved
      ? await unsaveLearningItem(user.id, itemType, itemId)
      : await saveLearningItem(user.id, itemType, itemId);
    if (result.error) {
      toast.error(result.error.message || "Could not update your saved items.");
    } else {
      setSaved(!saved);
      toast.success(saved ? "Removed from Saved." : "Added to Saved.");
    }
    setLoading(false);
  }

  return (
    <Button type="button" size={size} variant="ghost" className={className}
      aria-label={saved ? "Remove from saved learning" : "Save to learning"}
      title={saved ? "Remove from saved learning" : "Save to learning"}
      disabled={loading} onClick={() => void toggle()}>
      {saved ? <BookmarkCheck className="h-4 w-4 text-amber-400" /> : <Bookmark className="h-4 w-4" />}
    </Button>
  );
}
