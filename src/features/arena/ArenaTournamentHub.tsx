import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, Copy, ExternalLink, Gamepad2, Loader2, Plus, ShieldCheck, Swords, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/nexora/ui";

type GameKey = "efootball" | "fc_mobile" | "pubg_mobile" | "nexora_minigames";
type Tournament = {
  id: string; title: string; game_key: GameKey; platform_key: string; format_key: string;
  team_size: number; max_entries: number; status: string; description: string; rules: string;
  starts_at: string | null; registration_closes_at: string | null; created_by: string;
};
type Entry = { id: string; tournament_id: string; display_name: string; player_id: string | null; team_id: string | null; selected_club_name?: string | null; status: string };
type Match = { id: string; tournament_id: string; round_number: number; match_number: number; entry_a_id: string | null; entry_b_id: string | null; winner_entry_id: string | null; score_a: number | null; score_b: number | null; status: string; room_id?: string | null; room_password?: string | null };
type GamePlayerId = { entry_id: string; user_id: string; game_player_id: string };
const gameLaunch: Partial<Record<GameKey, { packageName: string; storeUrl: string }>> = { efootball: { packageName: "jp.konami.pesam", storeUrl: "https://play.google.com/store/apps/details?id=jp.konami.pesam" }, fc_mobile: { packageName: "com.ea.gp.fifamobile", storeUrl: "https://play.google.com/store/apps/details?id=com.ea.gp.fifamobile" }, pubg_mobile: { packageName: "com.tencent.ig", storeUrl: "https://play.google.com/store/apps/details?id=com.tencent.ig" } };
type Result = { id: string; match_id: string; score_a: number; score_b: number; evidence_path: string; notes: string; status: string; submitted_by: string };
type Standing = { entry_id: string; played: number; wins: number; draws: number; losses: number; points: number; eliminations: number; placement_points: number };
const games: { id: GameKey; name: string; subtitle: string; image: string; tint: string }[] = [
  { id: "efootball", name: "eFootball", subtitle: "Mobile + Console / PC · 1v1", image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1000&q=85", tint: "from-emerald-950/90" },
  { id: "fc_mobile", name: "EA SPORTS FC Mobile", subtitle: "Mobile · 1v1", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1000&q=85", tint: "from-blue-950/90" },
  { id: "pubg_mobile", name: "PUBG Mobile", subtitle: "Mobile · 4-player squads", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=85", tint: "from-orange-950/90" },
  { id: "nexora_minigames", name: "Nexora Mini-Games", subtitle: "Free Kick · Penalty · Trivia", image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1000&q=85", tint: "from-violet-950/90" },
];
const footballClubs = ["Arsenal","Aston Villa","Atalanta","Atletico Madrid","Barcelona","Bayern Munich","Borussia Dortmund","Chelsea","Inter Milan","Juventus","Liverpool","Manchester City","Manchester United","AC Milan","Napoli","Newcastle United","Paris Saint-Germain","Real Madrid","Roma","Tottenham Hotspur"];
const footballGames: GameKey[] = ["efootball","fc_mobile"];
const roundName = (round: number, total: number) => { const remaining = total - round; const labels: Record<number,string> = {0:"Final",1:"Semi-finals",2:"Quarter-finals",3:"Round of 16",4:"Round of 32",5:"Round of 64",6:"Round of 128"}; return labels[remaining] ?? `Round ${round}`; };
const input = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm";
const label = "mb-1.5 block text-xs font-semibold text-muted-foreground";
const gameName = (key: GameKey) => games.find((game) => game.id === key)?.name ?? key;
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Date to be announced";

export function ArenaTournamentHub() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [myTeamIds, setMyTeamIds] = useState<string[]>([]);
  const [pubgEntryId, setPubgEntryId] = useState("");
  const [pubgPlacement, setPubgPlacement] = useState("1");
  const [pubgEliminations, setPubgEliminations] = useState("0");
  const [selectedClub, setSelectedClub] = useState("");
  const [gamePlayerId, setGamePlayerId] = useState("");
  const [gamePlayerIds, setGamePlayerIds] = useState<GamePlayerId[]>([]);
  const [roomId, setRoomId] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [active, setActive] = useState<Tournament | null>(null);
  const [filter, setFilter] = useState<GameKey | "all">("all");
  const [tab, setTab] = useState<"discover" | "my" | "history">("discover");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [teamHandles, setTeamHandles] = useState("");
  const [teamName, setTeamName] = useState("");
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", game: "efootball" as GameKey, platform: "mobile", format: "single_elimination", teamSize: "1", capacity: "16", description: "", rules: "", starts: "", closes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: auth }, { data: tournamentRows }, { data: admin }] = await Promise.all([
      supabase.auth.getUser(),
      (supabase as any).from("arena_tournaments").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.rpc("my_is_platform_admin"),
    ]);
    const currentUser = auth.user?.id ?? null;
    setUserId(currentUser);
    setIsAdmin(Boolean(admin));
    const rows = (tournamentRows ?? []) as Tournament[];
    setTournaments(rows);
    if (active) {
      const current = rows.find((item) => item.id === active.id) ?? null;
      setActive(current);
      if (current) {
        const [entryResult, matchResult, standingResult, memberResult] = await Promise.all([
          (supabase as any).from("arena_tournament_entries").select("*").eq("tournament_id", current.id).order("created_at"),
          (supabase as any).from("arena_tournament_matches").select("*").eq("tournament_id", current.id).order("round_number").order("match_number"),
          (supabase as any).from("arena_tournament_standings").select("*").eq("tournament_id", current.id),
          currentUser
            ? (supabase as any).from("arena_tournament_team_members").select("team_id").eq("user_id", currentUser)
            : Promise.resolve({ data: [], error: null }),
        ]);
        const matchRows = (matchResult.data ?? []) as Match[];
        const matchIds = matchRows.map((match) => match.id);
        const entryIds = ((entryResult.data ?? []) as Entry[]).map((entry) => entry.id);
        const gameIdResult = entryIds.length ? await (supabase as any).from("arena_game_player_ids").select("entry_id,user_id,game_player_id").in("entry_id", entryIds) : { data: [], error: null };
        const resultResult = matchIds.length
          ? await (supabase as any).from("arena_match_results").select("*").in("match_id", matchIds).order("created_at", { ascending: false })
          : { data: [], error: null };
        setEntries((entryResult.data ?? []) as Entry[]);
        setMatches(matchRows);
        setGamePlayerIds((gameIdResult.data ?? []) as GamePlayerId[]);
        setResults((resultResult.data ?? []) as Result[]);
        setStandings((standingResult.data ?? []) as Standing[]);
        setMyTeamIds((memberResult.data ?? []).map((row: { team_id: string }) => row.team_id));
      }
    }
    setLoading(false);
  }, [active?.id]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => tournaments.filter((t) => filter === "all" || t.game_key === filter), [tournaments, filter]);
  const myTournaments = useMemo(() => tournaments.filter((t) => t.created_by === userId || entries.some((e) => e.tournament_id === t.id && e.player_id === userId)), [tournaments, entries, userId]);
  const createTournament = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("arena_create_tournament", {
      p_title: form.title.trim(), p_game_key: form.game, p_platform_key: form.platform,
      p_format_key: form.format, p_team_size: Number(form.teamSize), p_max_entries: Number(form.capacity),
      p_description: form.description, p_rules: form.rules,
      p_starts_at: form.starts ? new Date(form.starts).toISOString() : null,
      p_registration_closes_at: form.closes ? new Date(form.closes).toISOString() : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isAdmin ? "Tournament published." : "Tournament submitted for Nexora approval.");
    setShowCreate(false);
    setForm({ title: "", game: "efootball", platform: "mobile", format: "single_elimination", teamSize: "1", capacity: "16", description: "", rules: "", starts: "", closes: "" });
    await load();
    if (data) {
      const created = tournaments.find((t) => t.id === data);
      if (created) setActive(created);
    }
  };
  const registerSolo = async (tournament: Tournament) => {
    if (!userId) { toast.error("Sign in to register."); return; }
    const { data: profile } = await (supabase as any).from("profiles").select("display_name,handle").eq("id", userId).maybeSingle();
    const name = profile?.display_name || profile?.handle || "Nexora Player";
    const needsClub = footballGames.includes(tournament.game_key);
    if (needsClub && !selectedClub) { toast.error("Choose an available football club first."); return; }
    if (gameLaunch[tournament.game_key] && !gamePlayerId.trim()) { toast.error("Enter your in-game player ID before registering."); return; }
    const { data: entryId, error } = await supabase.rpc("arena_register_solo", { p_tournament_id: tournament.id, p_display_name: name, p_club_name: needsClub ? selectedClub : null });
    if (error) toast.error(error.message); else { if (entryId && gameLaunch[tournament.game_key]) { const { error: idError } = await (supabase as any).rpc("arena_set_game_player_id", { p_entry_id: entryId, p_game_player_id: gamePlayerId.trim() }); if (idError) { toast.error("Registered but game ID was not saved: " + idError.message); await load(); return; } } toast.success("Registration complete."); setGamePlayerId(""); await load(); }
  };
  const registerTeam = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || !userId) return;
    setBusy(true);
    const handles = [...new Set(teamHandles.split(/[\n,]+/).map((v) => v.trim().replace(/^@/, "").toLowerCase()).filter(Boolean))];
    const resolvedProfiles: { id: string }[] = [];
    for (const handle of handles) {
      const { data: profileData, error: profileError } = await supabase.rpc("get_public_profile", { p_handle: handle });
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      if (profileError || !profile?.id) {
        setBusy(false);
        toast.error(`Could not find public Nexora profile @${handle}. Ask that player to check their handle and profile visibility.`);
        return;
      }
      resolvedProfiles.push({ id: profile.id });
    }
    const ids = [...new Set([userId, ...resolvedProfiles.map((p) => p.id)])];
    const { error } = await supabase.rpc("arena_create_team", { p_tournament_id: active.id, p_name: teamName.trim(), p_member_ids: ids });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Squad registered."); setShowTeam(false); await load(); }
  };
  const approve = async (tournament: Tournament) => {
    const { error } = await supabase.rpc("arena_approve_tournament", { p_tournament_id: tournament.id });
    if (error) toast.error(error.message); else { toast.success("Tournament approved and published."); await load(); }
  };
  const generate = async (tournament: Tournament) => {
    const { error } = await supabase.rpc("arena_generate_bracket", { p_tournament_id: tournament.id });
    if (error) toast.error(error.message); else { toast.success("Fixtures generated."); await load(); }
  };
  const saveMyGameId = async () => {
    if (!myEntry || !gamePlayerId.trim()) { toast.error("Enter your in-game player ID."); return; }
    const { error } = await (supabase as any).rpc("arena_set_game_player_id", { p_entry_id: myEntry.id, p_game_player_id: gamePlayerId.trim() });
    if (error) toast.error(error.message); else { toast.success("Your in-game ID was saved."); setGamePlayerId(""); await load(); }
  };
  const saveRoom = async (matchId: string) => {
    const currentMatch = matches.find((item) => item.id === matchId);
    const { error } = await (supabase as any).rpc("arena_update_match_room", { p_match_id: matchId, p_room_id: roomId.trim() || currentMatch?.room_id || null, p_room_password: roomPassword.trim() || currentMatch?.room_password || null });
    if (error) toast.error(error.message); else { toast.success("Match room details saved."); setRoomId(""); setRoomPassword(""); await load(); }
  };
  const launchGame = (key: GameKey) => { const config = gameLaunch[key]; if (!config) return; if (!/Android/i.test(navigator.userAgent)) { window.open(config.storeUrl, "_blank", "noopener,noreferrer"); return; } window.location.href = "intent://launch/#Intent;package=" + config.packageName + ";S.browser_fallback_url=" + encodeURIComponent(config.storeUrl) + ";end"; };
  const copyValue = async (value: string, labelText: string) => { try { await navigator.clipboard.writeText(value); toast.success(labelText + " copied."); } catch { toast.error("Could not copy. Please copy manually."); } };
  const submitResult = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMatch || !evidence || !userId) return;
    setBusy(true);
    const path = selectedMatch + "/" + userId + "/" + Date.now() + "-" + evidence.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const upload = await supabase.storage.from("arena-match-evidence").upload(path, evidence, { upsert: false, contentType: evidence.type });
    if (upload.error) { setBusy(false); toast.error(upload.error.message); return; }
    const { error } = await supabase.rpc("arena_submit_match_result", { p_match_id: selectedMatch, p_score_a: Number(scoreA), p_score_b: Number(scoreB), p_evidence_path: path, p_notes: notes });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Result submitted for organizer verification."); setSelectedMatch(null); setEvidence(null); setNotes(""); await load(); }
  };
  const submitPubgPoints = async (matchId: string) => {
    if (!pubgEntryId) return;
    const { error } = await supabase.rpc("arena_update_pubg_points", { p_match_id: matchId, p_entry_id: pubgEntryId, p_placement: Number(pubgPlacement), p_eliminations: Number(pubgEliminations) });
    if (error) toast.error(error.message); else { toast.success("PUBG squad points saved."); await load(); }
  };
  const review = async (result: Result, decision: "confirm" | "reject") => {
    const { error } = await supabase.rpc("arena_review_match_result", { p_result_id: result.id, p_decision: decision });
    if (error) toast.error(error.message); else { toast.success(decision === "confirm" ? "Result verified; winner advanced." : "Result rejected for correction."); await load(); }
  };
  const tournamentEntries = entries.filter((entry) => entry.tournament_id === active?.id);
  const tournamentMatches = matches.filter((match) => match.tournament_id === active?.id);
  const tournamentResults = results.filter((result) => tournamentMatches.some((match) => match.id === result.match_id));
  const myEntry = tournamentEntries.find((entry) => entry.player_id === userId || (entry.team_id && myTeamIds.includes(entry.team_id)));
  const manager = Boolean(active && (active.created_by === userId || isAdmin));
  const entryLabel = (id: string | null) => tournamentEntries.find((entry) => entry.id === id)?.display_name ?? "To be decided";

  if (loading && !tournaments.length) return <Panel><div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading community tournaments…</div></Panel>;

  if (active) return <section className="space-y-4">
    <button type="button" onClick={() => { setActive(null); setEntries([]); setMatches([]); setResults([]); }} className="text-sm font-semibold text-primary">← All tournaments</button>
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="relative min-h-40 overflow-hidden bg-slate-950">
        <img src={games.find((g) => g.id === active.game_key)?.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-transparent" />
        <div className="relative space-y-2 p-5 text-white"><span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase">{active.status.replaceAll("_", " ")}</span><h2 className="max-w-xl text-xl font-black">{active.title}</h2><p className="text-xs text-white/80">{gameName(active.game_key)} · Free entry · {active.team_size > 1 ? `${active.team_size}-player teams` : "1v1 / Individual"}</p></div>
      </div>
      <div className="space-y-3 p-4"><p className="text-sm text-muted-foreground">{active.description || "Community tournament hosted on Nexora Arena."}</p><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-muted/50 p-3"><span className="text-muted-foreground">Capacity</span><p className="mt-1 font-bold">{tournamentEntries.length}/{active.max_entries} entries</p></div><div className="rounded-xl bg-muted/50 p-3"><span className="text-muted-foreground">Starts</span><p className="mt-1 font-bold">{dateLabel(active.starts_at)}</p></div></div>{active.rules && <div className="rounded-xl border p-3"><p className="mb-1 text-xs font-bold">Tournament rules</p><p className="whitespace-pre-wrap text-xs text-muted-foreground">{active.rules}</p></div>}
        {active.status === "pending_approval" && isAdmin && <Button onClick={() => void approve(active)} className="w-full">Approve and publish</Button>}
        {active.status === "open" && !manager && !myEntry && active.team_size === 1 && <div className="space-y-2">{footballGames.includes(active.game_key) && <div><label className={label}>Choose your in-game football club</label><select className={input} value={selectedClub} onChange={(e)=>setSelectedClub(e.target.value)}><option value="">Select an available club</option>{footballClubs.filter((club)=>!tournamentEntries.some((entry)=>entry.selected_club_name===club)).map((club)=><option key={club} value={club}>{club}</option>)}</select><p className="text-[10px] text-muted-foreground">Each club can be selected by only one player in this cup.</p></div>}{gameLaunch[active.game_key] && <div><label className={label}>Your {gameName(active.game_key)} player ID</label><input className={input} value={gamePlayerId} onChange={(e)=>setGamePlayerId(e.target.value)} placeholder="Enter your in-game ID" maxLength={80}/><p className="text-[10px] text-muted-foreground">Your opponent will see this ID on the match fixture.</p></div>}<Button onClick={() => void registerSolo(active)} disabled={(footballGames.includes(active.game_key) && !selectedClub) || (Boolean(gameLaunch[active.game_key]) && !gamePlayerId.trim())} className="w-full">Join free tournament</Button></div>}
        {active.status === "open" && !manager && active.team_size > 1 && !tournamentEntries.some((e) => e.team_id && e.player_id === userId) && <Button onClick={() => setShowTeam(true)} className="w-full">Register your squad</Button>}
        {manager && ["open","registration_closed"].includes(active.status) && <Button onClick={() => void generate(active)} className="w-full"><Swords className="mr-2 h-4 w-4"/> Generate automatic bracket</Button>}
      </div>
    </div>
    {showTeam && <Panel><form onSubmit={(e) => void registerTeam(e)} className="space-y-3"><h3 className="font-semibold">Register a four-player squad</h3><div><label className={label}>Team name</label><input className={input} value={teamName} onChange={(e) => setTeamName(e.target.value)} required maxLength={50}/></div><div><label className={label}>Other players' Nexora handles (one per line)</label><textarea className={input} rows={3} value={teamHandles} onChange={(e) => setTeamHandles(e.target.value)} placeholder="@player2, @player3, @player4" required/><p className="mt-1 text-[10px] text-muted-foreground">You are automatically added as captain. Add exactly three other registered Nexora users.</p></div><div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Registering…" : "Register squad"}</Button><Button type="button" variant="outline" onClick={() => setShowTeam(false)}>Cancel</Button></div></form></Panel>}
    <Panel><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Registered players & teams</h3><span className="text-xs text-muted-foreground">{tournamentEntries.length} entries</span></div>{tournamentEntries.length ? <div className="divide-y">{tournamentEntries.map((entry) => <div key={entry.id} className="flex items-center justify-between py-2 text-sm"><span className="min-w-0"><span className="block">{entry.display_name}</span>{entry.selected_club_name && <span className="text-[10px] text-muted-foreground">{entry.selected_club_name}</span>}</span><span className="text-[10px] capitalize text-muted-foreground">{entry.status}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No registrations yet. Be the first to join.</p>}</Panel>
    {myEntry && gameLaunch[active.game_key] && <Panel><h3 className="font-semibold">Your in-game player ID</h3><p className="my-1 text-xs text-muted-foreground">Keep this ID current so opponents can identify you.</p><div className="flex gap-2"><input className={input} value={gamePlayerId || gamePlayerIds.find((item)=>item.entry_id===myEntry.id && item.user_id===userId)?.game_player_id || ""} onChange={(e)=>setGamePlayerId(e.target.value)} placeholder="Your game ID" maxLength={80}/><Button size="sm" onClick={()=>void saveMyGameId()} disabled={!gamePlayerId.trim()}>Save</Button></div></Panel>}
    {tournamentMatches.length > 0 && <Panel><h3 className="mb-3 font-semibold">Fixtures & brackets</h3><div className="space-y-4">{Array.from(new Set(tournamentMatches.map((m) => m.round_number))).sort((a,b)=>a-b).map((round) => <div key={round}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{roundName(round, Math.max(...tournamentMatches.map((item)=>item.round_number)))}</p><div className="space-y-2">{tournamentMatches.filter((m) => m.round_number === round).map((match) => <div key={match.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{entryLabel(match.entry_a_id)}{tournamentEntries.find((entry)=>entry.id===match.entry_a_id)?.selected_club_name ? ` · ${tournamentEntries.find((entry)=>entry.id===match.entry_a_id)?.selected_club_name}` : ""}</span><strong className="tabular-nums">{match.score_a ?? "–"} : {match.score_b ?? "–"}</strong><span className="min-w-0 flex-1 truncate text-right">{entryLabel(match.entry_b_id)}{tournamentEntries.find((entry)=>entry.id===match.entry_b_id)?.selected_club_name ? ` · ${tournamentEntries.find((entry)=>entry.id===match.entry_b_id)?.selected_club_name}` : ""}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-[10px] capitalize text-muted-foreground">{match.status.replaceAll("_"," ")}</span>{!manager && active.game_key !== "pubg_mobile" && ["scheduled","disputed"].includes(match.status) && (myEntry?.id === match.entry_a_id || myEntry?.id === match.entry_b_id) && <button type="button" className="text-xs font-semibold text-primary" onClick={() => setSelectedMatch(match.id)}>Submit result</button>}</div>
{(myEntry?.id === match.entry_a_id || myEntry?.id === match.entry_b_id) && gameLaunch[active.game_key] && <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3">
<div className="flex items-center justify-between gap-2"><p className="text-xs font-bold">Game room & opponent</p><button type="button" onClick={()=>launchGame(active.game_key)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Gamepad2 className="h-3.5 w-3.5"/> Launch game <ExternalLink className="h-3 w-3"/></button></div>
<p className="text-[10px] text-muted-foreground">Nexora tries to open the Android game. If unavailable, use the Google Play fallback. Join the private room manually with these details.</p>
<div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-muted-foreground">Room ID</span><div className="mt-1 flex items-center gap-1"><strong className="break-all">{match.room_id || "Not set yet"}</strong>{match.room_id && <button type="button" onClick={()=>void copyValue(match.room_id!, "Room ID")}><Copy className="h-3.5 w-3.5"/></button>}</div></div><div><span className="text-muted-foreground">Password</span><div className="mt-1 flex items-center gap-1"><strong className="break-all">{match.room_password || "Not set yet"}</strong>{match.room_password && <button type="button" onClick={()=>void copyValue(match.room_password!, "Room password")}><Copy className="h-3.5 w-3.5"/></button>}</div></div></div>
<div><p className="mb-1 text-[10px] font-semibold text-muted-foreground">Player IDs</p>{[match.entry_a_id,match.entry_b_id].filter(Boolean).map((entryId)=>{const entry=tournamentEntries.find((item)=>item.id===entryId);const ids=gamePlayerIds.filter((item)=>item.entry_id===entryId);return <div key={entryId} className="flex items-center justify-between gap-2 text-xs"><span>{entry?.display_name || "Player"}</span><span>{ids.length?ids.map((item)=><button key={item.user_id} type="button" className="ml-1 underline" onClick={()=>void copyValue(item.game_player_id,"Player ID")}>{item.game_player_id}</button>):"ID not added"}</span></div>;})}</div></div>}
{manager && gameLaunch[active.game_key] && <div className="mt-3 space-y-2 rounded-lg border border-dashed p-3"><p className="text-xs font-bold">Organizer · Match room details</p><input className={input} value={roomId} onChange={(e)=>setRoomId(e.target.value)} placeholder={match.room_id || "Room ID"} maxLength={100}/><input className={input} value={roomPassword} onChange={(e)=>setRoomPassword(e.target.value)} placeholder={match.room_password ? "Update room password or leave blank to clear" : "Room password"} maxLength={100}/><Button size="sm" variant="outline" onClick={()=>void saveRoom(match.id)}>Save room details</Button></div>}{selectedMatch === match.id && <form onSubmit={(e) => void submitResult(e)} className="mt-3 space-y-2 border-t pt-3"><div className="grid grid-cols-2 gap-2"><div><label className={label}>Score A</label><input className={input} type="number" min="0" value={scoreA} onChange={(e)=>setScoreA(e.target.value)} required/></div><div><label className={label}>Score B</label><input className={input} type="number" min="0" value={scoreB} onChange={(e)=>setScoreB(e.target.value)} required/></div></div><div><label className={label}>Screenshot evidence</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>setEvidence(e.target.files?.[0] ?? null)} required className="block w-full text-xs"/></div><input className={input} value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Optional match notes"/><Button type="submit" disabled={busy || !evidence}>{busy ? "Submitting…" : "Send result for verification"}</Button></form>}</div>)}</div></div>)}</div></Panel>}
    {!manager && active.game_key === "pubg_mobile" && tournamentMatches.map((match) => <Panel key={match.id}><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">PUBG room · Round {match.round_number}</h3><button type="button" onClick={()=>launchGame(active.game_key)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Gamepad2 className="h-3.5 w-3.5"/> Launch game</button></div><p className="my-2 text-[10px] text-muted-foreground">Nexora tries to open PUBG Mobile. Enter the room details manually in-game.</p><div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-muted-foreground">Room ID</span><p className="font-semibold break-all">{match.room_id || "Not set yet"} {match.room_id && <button type="button" onClick={()=>void copyValue(match.room_id!, "Room ID")}><Copy className="inline h-3.5 w-3.5"/></button>}</p></div><div><span className="text-muted-foreground">Password</span><p className="font-semibold break-all">{match.room_password || "Not set yet"} {match.room_password && <button type="button" onClick={()=>void copyValue(match.room_password!, "Room password")}><Copy className="inline h-3.5 w-3.5"/></button>}</p></div></div><div className="mt-2 space-y-1 text-xs">{tournamentEntries.map((entry)=>{const ids=gamePlayerIds.filter((item)=>item.entry_id===entry.id);return <div key={entry.id} className="flex justify-between gap-2"><span>{entry.display_name}</span><span>{ids.length?ids.map((item)=><button key={item.user_id} type="button" className="ml-1 underline" onClick={()=>void copyValue(item.game_player_id,"Player ID")}>{item.game_player_id}</button>):"ID not added"}</span></div>;})}</div></Panel>)}
    {manager && active.game_key === "pubg_mobile" && tournamentMatches.map((match) => <Panel key={match.id}><h3 className="font-semibold">PUBG scoring · Round {match.round_number}</h3><p className="my-2 text-xs text-muted-foreground">Award placement points (101 minus placement) plus one point per elimination for each registered squad.</p><div className="my-3 space-y-2 rounded-lg border border-dashed p-3"><p className="text-xs font-bold">Match room details</p><input className={input} value={roomId} onChange={(e)=>setRoomId(e.target.value)} placeholder={match.room_id || "Room ID"} maxLength={100}/><input className={input} value={roomPassword} onChange={(e)=>setRoomPassword(e.target.value)} placeholder={match.room_password || "Room password"} maxLength={100}/><Button size="sm" variant="outline" onClick={()=>void saveRoom(match.id)}>Save room details</Button><div className="text-xs">{tournamentEntries.map((entry)=>{const ids=gamePlayerIds.filter((item)=>item.entry_id===entry.id);return <div key={entry.id} className="flex justify-between gap-2 py-1"><span>{entry.display_name}</span><span>{ids.length?ids.map((item)=><button key={item.user_id} type="button" className="ml-1 underline" onClick={()=>void copyValue(item.game_player_id,"Player ID")}>{item.game_player_id}</button>):"ID not added"}</span></div>;})}</div></div><div className="grid grid-cols-2 gap-2"><div><label className={label}>Squad</label><select className={input} value={pubgEntryId} onChange={(e)=>setPubgEntryId(e.target.value)}><option value="">Choose squad</option>{tournamentEntries.map((entry)=><option key={entry.id} value={entry.id}>{entry.display_name}</option>)}</select></div><div><label className={label}>Placement</label><input className={input} type="number" min="1" max="128" value={pubgPlacement} onChange={(e)=>setPubgPlacement(e.target.value)}/></div><div><label className={label}>Eliminations</label><input className={input} type="number" min="0" max="100" value={pubgEliminations} onChange={(e)=>setPubgEliminations(e.target.value)}/></div></div><Button className="mt-2" size="sm" disabled={!pubgEntryId} onClick={()=>void submitPubgPoints(match.id)}>Save squad points</Button></Panel>)}
    {manager && tournamentResults.some((r) => r.status === "pending") && <Panel><h3 className="mb-3 font-semibold">Match verification queue</h3>{tournamentResults.filter((r)=>r.status==="pending").map((result)=><div key={result.id} className="mb-3 rounded-xl border p-3"><p className="text-sm font-semibold">Submitted score: {result.score_a} – {result.score_b}</p><p className="my-1 text-xs text-muted-foreground">{result.notes || "Screenshot submitted for review"}</p><button type="button" className="mb-2 text-xs text-primary underline" onClick={async()=>{const {data,error}=await supabase.storage.from("arena-match-evidence").createSignedUrl(result.evidence_path,300);if(error)toast.error(error.message);else window.open(data.signedUrl,"_blank","noopener,noreferrer");}}>View evidence (5 min link)</button><div className="flex gap-2"><Button size="sm" onClick={()=>void review(result,"confirm")}><CheckCircle2 className="mr-1 h-3.5 w-3.5"/> Verify & advance</Button><Button size="sm" variant="outline" onClick={()=>void review(result,"reject")}>Reject</Button></div></div>)}</Panel>}
    <Panel><h3 className="mb-3 flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-amber-500"/> Tournament standings</h3>{standings.length ? <div className="space-y-2">{[...standings].sort((a,b)=>b.points-a.points||b.wins-a.wins||b.eliminations-a.eliminations).map((standing,index) => <div key={standing.entry_id} className="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"><span className="font-bold text-muted-foreground">#{index+1}</span><span className="min-w-0 truncate font-semibold">{entryLabel(standing.entry_id)}{tournamentEntries.find((entry)=>entry.id===standing.entry_id)?.selected_club_name ? ` · ${tournamentEntries.find((entry)=>entry.id===standing.entry_id)?.selected_club_name}` : ""}</span><span className="text-right tabular-nums"><strong>{standing.points} pts</strong><span className="ml-2 text-muted-foreground">{standing.wins}W · {standing.losses}L · {standing.eliminations} KOs</span></span></div>)}</div> : <p className="text-xs text-muted-foreground">Standings appear after verified match results or PUBG round scores.</p>}</Panel>
  </section>;

  return <section className="space-y-4">
    <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-500/15 via-card to-card p-4 sm:p-5"><div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500"/><h2 className="font-display text-lg font-bold">Arena Cups & Brackets</h2></div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Compete with the community. Every tournament is free to enter, with verified results and champions recorded on Nexora.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={()=>setShowCreate((v)=>!v)}><Plus className="mr-1 h-4 w-4"/> Create tournament</Button><span className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500"/> Free entry · Fair play</span></div></div>
    <div className="grid grid-cols-2 gap-2">{games.map((game)=><button key={game.id} type="button" onClick={()=>setFilter(filter===game.id?"all":game.id)} className={`group relative min-h-32 overflow-hidden rounded-xl border text-left ${filter===game.id?"ring-2 ring-primary":""}`}><img src={game.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><div className={`absolute inset-0 bg-gradient-to-t ${game.tint} via-black/20 to-transparent`}/><div className="absolute inset-x-0 bottom-0 p-3 text-white"><p className="text-sm font-black leading-tight">{game.name}</p><p className="mt-1 text-[10px] text-white/80">{game.subtitle}</p></div></button>)}</div>
    {showCreate && <Panel><form onSubmit={(e)=>void createTournament(e)} className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-semibold">Create a free tournament</h3><button type="button" onClick={()=>setShowCreate(false)} className="text-xs text-muted-foreground">Close</button></div><div><label className={label}>Tournament name</label><input className={input} value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} minLength={4} maxLength={80} required placeholder="e.g. Nexora eFootball Community Cup"/></div><div className="grid grid-cols-2 gap-2"><div><label className={label}>Game</label><select className={input} value={form.game} onChange={(e)=>{const game=e.target.value as GameKey;setForm({...form,game,teamSize:game==="pubg_mobile"?"4":"1",platform:game==="nexora_minigames"?"not_applicable":"mobile",format:game==="pubg_mobile"?"battle_royale_points":game==="nexora_minigames"?"mini_game_challenge":"single_elimination"})}}>{games.map((g)=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div><div><label className={label}>Platform</label><select className={input} value={form.platform} onChange={(e)=>setForm({...form,platform:e.target.value})}>{form.game==="efootball"?<><option value="mobile">Mobile</option><option value="console_pc">Console / PC</option><option value="cross_platform">Cross-platform</option></>:form.game==="nexora_minigames"?<option value="not_applicable">Not applicable</option>:<option value="mobile">Mobile</option>}</select></div><div><label className={label}>Format</label><select className={input} value={form.format} onChange={(e)=>setForm({...form,format:e.target.value})}>{form.game==="pubg_mobile"?<><option value="battle_royale_points">PUBG placement points</option><option value="single_elimination">Knockout bracket</option></>:form.game==="nexora_minigames"?<><option value="mini_game_challenge">Mini-game challenge</option><option value="single_elimination">Knockout bracket</option></>:<option value="single_elimination">Knockout bracket</option>}</select></div><div><label className={label}>Entries / teams</label><select className={input} value={form.capacity} onChange={(e)=>setForm({...form,capacity:e.target.value})}>{[8,16,32,64,128].map((v)=><option key={v}>{v}</option>)}</select></div></div><div><label className={label}>Description</label><textarea className={input} rows={2} maxLength={1200} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div><div><label className={label}>Rules</label><textarea className={input} rows={3} maxLength={4000} value={form.rules} onChange={(e)=>setForm({...form,rules:e.target.value})} placeholder="Match length, room details, fair-play rules…"/></div><div className="grid grid-cols-2 gap-2"><div><label className={label}>Start time</label><input type="datetime-local" className={input} value={form.starts} onChange={(e)=>setForm({...form,starts:e.target.value})}/></div><div><label className={label}>Registration closes</label><input type="datetime-local" className={input} value={form.closes} onChange={(e)=>setForm({...form,closes:e.target.value})}/></div></div><p className="text-[11px] text-muted-foreground">{isAdmin?"As an administrator, this tournament will publish immediately.":"Community tournaments are reviewed by Nexora administrators before appearing publicly."} Entry is always free.</p><Button type="submit" disabled={busy || !form.title.trim()} className="w-full">{busy?"Creating…":"Submit tournament"}</Button></form></Panel>}
    <div className="flex gap-2 overflow-x-auto pb-1">{(["discover","my","history"] as const).map((item)=><button key={item} type="button" onClick={()=>setTab(item)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${tab===item?"border-primary bg-primary text-primary-foreground":"hover:bg-muted"}`}>{item==="my"?"My tournaments":item}</button>)}</div>
    <div className="flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={()=>setFilter("all")} className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${filter==="all"?"bg-muted font-bold":""}`}>All games</button>{games.map((g)=><button key={g.id} type="button" onClick={()=>setFilter(g.id)} className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${filter===g.id?"bg-muted font-bold":""}`}>{g.name}</button>)}</div>
    {loading?<p className="py-6 text-center text-sm text-muted-foreground">Refreshing tournaments…</p>:visible.filter((t)=>tab==="history"?t.status==="completed":tab==="my"?t.created_by===userId:t.status!=="completed").length===0?<div className="rounded-xl border border-dashed p-6 text-center"><Trophy className="mx-auto mb-2 h-7 w-7 text-muted-foreground"/><p className="font-semibold">No tournaments here yet</p><p className="mt-1 text-xs text-muted-foreground">Create a free community cup or check back for upcoming competitions.</p></div>:<div className="space-y-3">{visible.filter((t)=>tab==="history"?t.status==="completed":tab==="my"?t.created_by===userId:t.status!=="completed").map((t)=><button key={t.id} type="button" onClick={()=>setActive(t)} className="w-full overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-primary/50"><div className="relative h-28 overflow-hidden"><img src={games.find((g)=>g.id===t.game_key)?.image} alt="" loading="lazy" className="h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent"/><div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white"><div><p className="text-[10px] font-semibold uppercase tracking-wide">{gameName(t.game_key)} · Free entry</p><p className="mt-1 text-base font-black">{t.title}</p></div><span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold uppercase">{t.status.replaceAll("_"," ")}</span></div></div><div className="flex items-center justify-between gap-2 p-3"><span className="flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarDays className="h-3.5 w-3.5"/>{dateLabel(t.starts_at)}</span><span className="flex items-center gap-1 text-xs font-semibold text-primary">View cup <ChevronRight className="h-3.5 w-3.5"/></span></div></button>)}</div>}
    <p className="text-[10px] text-muted-foreground">Third-party competitions are community-run and are not affiliated with or endorsed by the game publishers. Publisher rules apply.</p>
  </section>;
}
