import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Award, MessageSquareText, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import type { FootballMatch } from "./types";

type Scorer = { id: string; player_name: string; team_name: string; goals: number; assists: number; competition_code: string; competition_name: string };
type Poll = { id: string; match_id: string; closes_at: string };
type Vote = { poll_id: string; player_name: string; rating: number; tactical_take: string };

export function GoldenBootLeaderboard() {
  const [rows, setRows] = useState<Scorer[]>([]);
  const [competition, setCompetition] = useState("PL");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (supabase as any).from("football_scorers").select("id,player_name,team_name,goals,assists,competition_code,competition_name")
      .eq("competition_code", competition).order("goals", { ascending: false }).order("assists", { ascending: false }).limit(15)
      .then(({ data, error }: { data: Scorer[] | null; error: unknown }) => {
        if (!active) return;
        if (error) toast.error("Golden Boot standings are temporarily unavailable.");
        setRows(data ?? []); setLoading(false);
      });
    return () => { active = false; };
  }, [competition]);
  return <section className="rounded-2xl border bg-card p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-amber-500" /> Golden Boot · Top scorers</h2><p className="text-xs text-muted-foreground">Cached daily across the season</p></div>
      <select aria-label="Scorer competition" className="rounded-lg border bg-background px-2 py-1.5 text-xs" value={competition} onChange={(event) => { setLoading(true); setCompetition(event.target.value); }}>
        <option value="PL">Premier League</option><option value="CL">Champions League</option><option value="PD">La Liga</option><option value="BL1">Bundesliga</option><option value="SA">Serie A</option><option value="FL1">Ligue 1</option>
      </select></div>
    {loading ? <p className="py-4 text-center text-xs text-muted-foreground">Loading scorer table…</p> : rows.length ? <div className="divide-y">{rows.map((row, index) => <div key={row.id} className="flex items-center gap-3 py-2 text-sm"><span className="w-5 text-xs tabular-nums text-muted-foreground">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-medium">{row.player_name}</p><p className="truncate text-[11px] text-muted-foreground">{row.team_name}</p></div><span className="text-right text-xs text-muted-foreground">{row.assists} A</span><span className="w-8 text-right font-bold tabular-nums">{row.goals}</span></div>)}</div> : <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">No scorer data cached yet. The daily provider sync will populate this table.</p>}
  </section>;
}

export function MatchdayFanPolls({ matches }: { matches: FootballMatch[] }) {
  const { user } = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [player, setPlayer] = useState<Record<string, string>>({});
  const [rating, setRating] = useState<Record<string, number>>({});
  const [take, setTake] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const finished = useMemo(() => matches.filter((match) => match.status === "FT"), [matches]);
  useEffect(() => {
    let active = true;
    if (!finished.length) { setPolls([]); return; }
    void (supabase as any).from("football_match_polls").select("id,match_id,closes_at").in("match_id", finished.map((match) => match.id)).gt("closes_at", new Date().toISOString()).order("created_at", { ascending: false })
      .then(async ({ data, error }: { data: Poll[] | null; error: unknown }) => {
        if (!active) return;
        if (error) { setPolls([]); return; }
        const list = data ?? []; setPolls(list);
        if (user && list.length) {
          const result = await (supabase as any).from("football_match_fan_votes").select("poll_id,player_name,rating,tactical_take").eq("user_id", user.id).in("poll_id", list.map((poll) => poll.id));
          if (active && !result.error) {
            const mapped: Record<string, Vote> = {};
            for (const vote of result.data ?? []) mapped[vote.poll_id] = vote;
            setVotes(mapped);
          }
        }
      });
    return () => { active = false; };
  }, [finished, user?.id]);
  const submit = async (poll: Poll) => {
    if (!user) { toast.error("Sign in to vote in the post-match poll."); return; }
    const name = (player[poll.id] ?? "").trim();
    const tactical = (take[poll.id] ?? "").trim();
    const score = rating[poll.id] ?? 8;
    if (name.length < 2 || tactical.length < 1) { toast.error("Enter a player name and a short tactical take."); return; }
    setBusy(poll.id);
    const result = await (supabase as any).from("football_match_fan_votes").upsert({ poll_id: poll.id, user_id: user.id, player_name: name, rating: score, tactical_take: tactical, updated_at: new Date().toISOString() }, { onConflict: "poll_id,user_id" });
    setBusy(null);
    if (result.error) { toast.error("Your vote could not be saved. Check that the 24-hour poll is still open."); return; }
    setVotes((current) => ({ ...current, [poll.id]: { poll_id: poll.id, player_name: name, rating: score, tactical_take: tactical } }));
    toast.success("Your post-match vote has been recorded.");
  };
  if (!polls.length) return null;
  return <section className="rounded-2xl border bg-card p-4"><div className="mb-3 flex items-center gap-2"><Award className="h-4 w-4 text-primary" /><h2 className="font-semibold">Man of the Match · Fan ratings</h2></div><div className="space-y-4">{polls.map((poll) => {
    const match = finished.find((item) => item.id === poll.match_id);
    if (!match) return null;
    const existing = votes[poll.id];
    return <div key={poll.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-semibold">{match.homeTeam} {match.homeScore} – {match.awayScore} {match.awayTeam}</p><p className="text-[10px] text-muted-foreground">{match.competitionName}</p></div><span className="shrink-0 text-[10px] text-muted-foreground">Closes {new Date(poll.closes_at).toLocaleString()}</span></div>
      {existing ? <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm"><p className="font-semibold">Your Man of the Match: {existing.player_name}</p><p className="mt-1 text-xs text-muted-foreground">Your rating: {existing.rating}/10</p><p className="mt-1 text-xs">{existing.tactical_take}</p><p className="mt-2 text-[10px] text-muted-foreground">You can update your vote while the poll is open.</p></div> : <div className="mt-3 grid gap-2"><input className="w-full rounded-lg border bg-background px-3 py-2 text-sm" maxLength={80} placeholder="Nominate any player by name" value={player[poll.id] ?? ""} onChange={(event) => setPlayer((current) => ({ ...current, [poll.id]: event.target.value }))} /><label className="text-xs font-medium">Rate this match: {rating[poll.id] ?? 8}/10<input className="mt-1 w-full accent-primary" type="range" min="1" max="10" value={rating[poll.id] ?? 8} onChange={(event) => setRating((current) => ({ ...current, [poll.id]: Number(event.target.value) }))} /></label><textarea className="w-full rounded-lg border bg-background px-3 py-2 text-sm" rows={2} maxLength={240} placeholder="One-line tactical take (240 characters max)" value={take[poll.id] ?? ""} onChange={(event) => setTake((current) => ({ ...current, [poll.id]: event.target.value }))} /><button type="button" disabled={busy === poll.id} onClick={() => void submit(poll)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{busy === poll.id ? "Saving…" : "Submit fan vote"}</button></div>}
    </div>;
  })}</div></section>;
}

export function useMatchdayForm(matches: FootballMatch[]) {
  const [formByTeam, setFormByTeam] = useState<Record<string, Array<{ result: string; opponent: string }>>>({});
  const teamNames = useMemo(() => [...new Set(matches.flatMap((match) => [match.homeTeam, match.awayTeam]))].sort(), [matches]);
  const key = teamNames.join("|");
  useEffect(() => {
    let active = true;
    if (!teamNames.length) { setFormByTeam({}); return; }
    void (supabase as any).rpc("get_football_form_guide", { p_team_names: teamNames }).then(({ data, error }: { data: Array<{ team_name: string; result: string; opponent: string }> | null; error: unknown }) => {
      if (!active || error) return;
      const next: Record<string, Array<{ result: string; opponent: string }>> = {};
      for (const row of data ?? []) (next[row.team_name] ??= []).push({ result: row.result, opponent: row.opponent });
      setFormByTeam(next);
    });
    return () => { active = false; };
  }, [key]);
  return formByTeam;
}

export function TeamFormGuide({ teamName, form }: { teamName: string; form?: Array<{ result: string; opponent: string }> }) {
  if (!form?.length) return null;
  return <div className="mt-1 flex items-center gap-1" aria-label={teamName + " last five results"}><span className="mr-1 text-[9px] text-muted-foreground">FORM</span>{form.map((item, index) => <span key={index} title={item.result + " vs " + item.opponent} className={"grid h-4 w-4 place-items-center rounded text-[9px] font-bold text-white " + (item.result === "W" ? "bg-emerald-600" : item.result === "D" ? "bg-amber-500" : "bg-red-600")}>{item.result}</span>)}</div>;
}

export function isMajorFixture(match: FootballMatch) {
  const code = match.competitionCode.toUpperCase();
  const derby = /arsenal.*tottenham|tottenham.*arsenal|manchester city.*manchester united|manchester united.*manchester city|liverpool.*everton|everton.*liverpool|real madrid.*barcelona|barcelona.*real madrid|inter.*milan|milan.*inter/i.test(match.homeTeam + " " + match.awayTeam);
  return code === "CL" || code === "UCL" || code === "PL" && derby;
}

export function MatchAudioPrompt({ match }: { match: FootballMatch }) {
  const { user } = useSession();
  const [membership, setMembership] = useState<{ role: string; status: string } | null>(null);
  const minutes = (new Date(match.kickoffAt).getTime() - Date.now()) / 60000;
  const eligible = minutes > 0 && minutes <= 15 && isMajorFixture(match);
  useEffect(() => {
    let active = true;
    if (!user || !eligible) { setMembership(null); return; }
    void (supabase as any).from("club_memberships").select("role,status").eq("user_id", user.id).eq("status", "active").in("role", ["creator", "admin"]).limit(1).maybeSingle()
      .then(({ data }: { data: { role: string; status: string } | null }) => { if (active) setMembership(data); });
    return () => { active = false; };
  }, [user?.id, eligible]);
  if (!eligible || !membership) return null;
  return <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2"><p className="flex items-center gap-2 text-xs font-semibold"><Users className="h-3.5 w-3.5" /> Kickoff in about {Math.max(1, Math.ceil(minutes))} min — start a squad audio room.</p><Link to="/calls" search={{ arenaAudio: true }} className="mt-2 inline-flex rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Launch audio watch-along</Link></div>;
}

export function MatchReactionLink({ match }: { match: FootballMatch }) {
  if (match.status !== "FT") return null;
  const hashtag = "#" + (match.homeTeam.replace(/[^a-z0-9]/gi, "").slice(0, 12) + "v" + match.awayTeam.replace(/[^a-z0-9]/gi, "").slice(0, 12)).toUpperCase();
  const caption = "Full-time: " + match.homeTeam + " " + match.homeScore + "–" + match.awayScore + " " + match.awayTeam + " " + hashtag + " #NexoraArena";
  return <Link to="/create" search={{} as never} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted" onClick={() => { window.sessionStorage.setItem("nexora:match-reaction-caption", caption); window.sessionStorage.setItem("nexora:match-reaction-max-seconds", "15"); }}><MessageSquareText className="h-3.5 w-3.5" /> Post reaction to Reels/Feed</Link>;
}
