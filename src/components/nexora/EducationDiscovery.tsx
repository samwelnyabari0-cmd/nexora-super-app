import { useEffect, useState } from "react";
import { GraduationCap, BookOpen, Image as ImageIcon, Play, ExternalLink, Brain, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type EducationVideo = {
  id: string;
  provider_id: string;
  match_label: string;
  source_name: string;
  thumbnail_url: string | null;
  published_at: string;
};
type TriviaQuestion = { question: string; correct_answer: string; incorrect_answers: string[]; category: string };
type NasaImage = { id: string; title: string; description: string; image: string; nasaUrl: string };

const resources = [
  { title: "OpenStax textbooks", detail: "Free, peer-reviewed textbooks for science, maths and more.", url: "https://openstax.org/subjects" },
  { title: "Khan Academy", detail: "Free lessons and practice across school and university subjects.", url: "https://www.khanacademy.org/" },
  { title: "MIT OpenCourseWare", detail: "Lecture notes, assignments and course materials from MIT.", url: "https://ocw.mit.edu/" },
  { title: "Open Library", detail: "Discover books and reading material across thousands of subjects.", url: "https://openlibrary.org/" },
];

function decodeHtml(value: string) {
  const node = document.createElement("textarea");
  node.innerHTML = value;
  return node.value;
}

function EducationVideoCard({ video }: { video: EducationVideo }) {
  const [playing, setPlaying] = useState(false);
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe title={video.match_label}
            src={"https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.provider_id) + "?autoplay=1&rel=0"}
            loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen className="h-full w-full" />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={"Play lesson " + video.match_label} className="group relative h-full w-full">
            <img src={video.thumbnail_url || "https://i.ytimg.com/vi/" + encodeURIComponent(video.provider_id) + "/hqdefault.jpg"}
              alt="" loading="lazy" className="h-full w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/25">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="h-5 w-5 fill-current" /></span>
            </span>
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">{video.source_name}</p>
        <h3 className="line-clamp-2 text-sm font-semibold">{video.match_label}</h3>
      </div>
    </article>
  );
}

function DailyQuiz() {
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadQuestion() {
    setLoading(true);
    setSelected(null);
    setRevealed(false);
    try {
      const category = [18, 19, 17][Math.floor(Math.random() * 3)];
      const response = await fetch("https://opentdb.com/api.php?amount=1&category=" + category + "&type=multiple");
      if (!response.ok) throw new Error("Quiz unavailable");
      const payload = await response.json();
      const row = payload.results?.[0] as TriviaQuestion | undefined;
      if (!row) throw new Error("No question returned");
      setQuestion(row);
      setAnswers([...row.incorrect_answers, row.correct_answer].sort(() => Math.random() - 0.5));
    } catch {
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadQuestion(); }, []);

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-primary"><Brain className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-wider">Quick knowledge check</span></div>
      {loading ? <p className="text-sm text-muted-foreground">Loading a free practice question…</p> : question ? (
        <>
          <p className="mb-3 text-sm font-semibold">{decodeHtml(question.question)}</p>
          <div className="grid gap-2">
            {answers.map((answer) => (
              <button key={answer} type="button" disabled={revealed} onClick={() => { setSelected(answer); setRevealed(true); }}
                className={"rounded-xl border px-3 py-2 text-left text-sm " + (revealed && answer === question.correct_answer ? "border-emerald-500 bg-emerald-500/10" : revealed && answer === selected ? "border-destructive bg-destructive/10" : "hover:bg-muted")}>
                {decodeHtml(answer)}
              </button>
            ))}
          </div>
          {revealed && <p className="mt-3 flex items-center gap-2 text-xs font-medium">{selected === question.correct_answer ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}{selected === question.correct_answer ? "Correct — well done!" : "Not quite. The correct answer is " + decodeHtml(question.correct_answer) + "."}</p>}
          <button type="button" onClick={() => void loadQuestion()} className="mt-3 text-xs font-semibold text-primary">Try another question</button>
        </>
      ) : <p className="text-sm text-muted-foreground">The free quiz service is temporarily unavailable. Try again later.</p>}
    </section>
  );
}

function OpenLearningResources() {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Free learning library</p><h3 className="font-bold">Study resources</h3></div>
        <BookOpen className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {resources.map((resource) => (
          <a key={resource.title} href={resource.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border bg-card p-3 transition-colors hover:bg-muted">
            <span className="flex items-center justify-between gap-2 text-sm font-semibold">{resource.title}<ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{resource.detail}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function ScienceGallery() {
  const [images, setImages] = useState<NasaImage[]>([]);
  useEffect(() => {
    let active = true;
    void fetch("https://images-api.nasa.gov/search?q=earth%20science&media_type=image&page_size=6")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Gallery unavailable")))
      .then((payload) => {
        if (!active) return;
        const rows = (payload.collection?.items ?? []).slice(0, 4).flatMap((item: any) => {
          const data = item.data?.[0];
          const image = item.links?.find((link: any) => link.render === "image")?.href;
          return data && image ? [{ id: item.data[0].nasa_id, title: String(data.title ?? "Science image"), description: String(data.description ?? "").replace(/<[^>]*>/g, "").slice(0, 180), image, nasaUrl: "https://images.nasa.gov/details/" + encodeURIComponent(item.data[0].nasa_id) }] : [];
        });
        setImages(rows);
      }).catch(() => { if (active) setImages([]); });
    return () => { active = false; };
  }, []);
  if (!images.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /><h3 className="font-bold">Science in pictures</h3></div>
      <div className="grid grid-cols-2 gap-3">
        {images.map((item) => <a key={item.id} href={item.nasaUrl} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border bg-card">
          <img src={item.image} alt={item.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <div className="p-2"><p className="line-clamp-2 text-xs font-semibold">{item.title}</p><p className="mt-1 line-clamp-3 text-[10px] text-muted-foreground">{item.description}</p></div>
        </a>)}
      </div>
    </section>
  );
}

export function EducationDiscovery({ variant = "full" }: { variant?: "full" | "compact" | "reels" }) {
  const [videos, setVideos] = useState<EducationVideo[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (supabase as any).from("football_highlights")
      .select("id,provider_id,match_label,source_name,thumbnail_url,published_at")
      .eq("provider", "youtube-education").eq("is_published", true)
      .order("published_at", { ascending: false }).limit(variant === "compact" ? 2 : 8)
      .then(({ data, error }: { data: EducationVideo[] | null; error: { message: string } | null }) => {
        if (!active) return;
        if (error) console.warn("Education videos unavailable:", error.message);
        setVideos(data ?? []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [variant]);

  return (
    <section className="min-w-0 space-y-4" aria-label="Education and learning">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><GraduationCap className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Learn something new</p><h2 className="text-lg font-bold">Education</h2></div></div>
        <Link to="/learn" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">Continue Learning <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      {loading ? <p className="text-xs text-muted-foreground">Loading free lessons…</p> : videos.length ? (
        <div className={variant === "compact" ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2"}>{videos.map((video) => <EducationVideoCard key={video.id} video={video} />)}</div>
      ) : <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">New free video lessons are being collected. Explore the resources below in the meantime.</p>}
      {variant !== "compact" && <><DailyQuiz /><ScienceGallery /><OpenLearningResources /></>}
    </section>
  );
}
