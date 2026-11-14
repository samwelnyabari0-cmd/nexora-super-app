import m1 from "@/assets/media-1.jpg";
import m2 from "@/assets/media-2.jpg";
import m3 from "@/assets/media-3.jpg";
import m4 from "@/assets/media-4.jpg";

export const media = { m1, m2, m3, m4 };

export type Creator = { id: string; name: string; handle: string; hue: number; verified?: boolean };
export type Post = {
  id: string;
  creatorId: string;
  kind: "short" | "video" | "post";
  image?: string;
  mediaType?: string;
  filter?: string;
  format?: string;
  audience?: "public" | "private";
  caption: string;
  tags: string[];
    likes: number;
  comments: {
  id: string;
  author: string;
  text: string;
  createdAt?: string;
}[];
  shares: number;
  reposts?: number;
  duration?: string;
  place?: string;
  createdAt: string;
};

export const creators: Creator[] = [
  { id: "c1", name: "Amani Otieno", handle: "amani.frames", hue: 295, verified: true },
  { id: "c2", name: "Wanjiku Eats", handle: "wanjikueats", hue: 40 },
  { id: "c3", name: "Zuri Motion", handle: "zuri.moves", hue: 330, verified: true },
  { id: "c4", name: "Safari Lens", handle: "safarilens", hue: 25 },
  { id: "c5", name: "Kibet Codes", handle: "kibet.dev", hue: 205 },
  { id: "c6", name: "Lena Mwangi", handle: "lena.studio", hue: 160 },
];

export const creatorById = (id: string) => creators.find((c) => c.id === id) ?? creators[0];

export const seedPosts: Post[] = [
  {
    id: "p1",
    creatorId: "c1",
    kind: "short",
    image: m1,
    duration: "0:42",
    caption:
      "Golden hour over the CBD — shot entirely on phone. Full colour grade breakdown in comments.",
    tags: ["city", "creators"],
    likes: 12840,
    shares: 412,
    place: "Upper Hill Rooftop, Nairobi",
    createdAt: "2h",
    comments: [{ id: "k1", author: "lena.studio", text: "That purple sky is unreal 😮" }],
  },
  {
    id: "p2",
    creatorId: "c2",
    kind: "short",
    image: m2,
    duration: "0:58",
    caption: "Night market mshikaki run. 3 stalls, 1 winner. Who's coming Friday?",
    tags: ["food", "nearby"],
    likes: 8320,
    shares: 960,
    place: "Kenyatta Night Market",
    createdAt: "4h",
    comments: [{ id: "k2", author: "kibet.dev", text: "Stall #2 every time." }],
  },
  {
    id: "p3",
    creatorId: "c3",
    kind: "short",
    image: m3,
    duration: "1:05",
    caption: "New choreo drop 💜 Learn it in 3 steps — tutorial on my Watch channel.",
    tags: ["music", "dance"],
    likes: 30211,
    shares: 2210,
    createdAt: "6h",
    comments: [],
  },
  {
    id: "p4",
    creatorId: "c4",
    kind: "video",
    image: m4,
    duration: "18:20",
    caption: "Maasai Mara at dusk — a slow film about the last light.",
    tags: ["travel", "nature"],
    likes: 5402,
    shares: 188,
    place: "Maasai Mara Reserve",
    createdAt: "1d",
    comments: [{ id: "k3", author: "amani.frames", text: "Cinematic 🔥" }],
  },
  {
    id: "p5",
    creatorId: "c5",
    kind: "post",
    caption:
      "Shipping offline-first is a feature, not an afterthought. Queue locally, sync later, show the user what's pending. That's how you build for real networks.",
    tags: ["tech", "creators"],
    likes: 1204,
    shares: 96,
    createdAt: "1d",
    comments: [],
  },
];

export const feedFilters = [
  "For you",
  "Following",
  "Nearby",
  "Music",
  "Food",
  "Tech",
  "Travel",
] as const;

export type Message = {
  id: string;
  from: "me" | "them";
  text: string;
  at: string;
  status?: "sending" | "sent" | "queued" | "failed";
  attachments?: import("./tools").Attachment[];
  replyTo?: string;
  edited?: boolean;
};
export type Conversation = { id: string; creatorId: string; messages: Message[]; unread: number; ownerId?: string };

export const seedConversations: Conversation[] = [
  {
    id: "t1",
    creatorId: "c2",
    unread: 2,
    messages: [
      {
        id: "a",
        from: "them",
        text: "Are you still coming to the night market Friday?",
        at: "18:02",
      },
      { id: "b", from: "them", text: "I'll save you a seat at stall #2 😄", at: "18:03" },
    ],
  },
  {
    id: "t2",
    creatorId: "c1",
    unread: 0,
    messages: [
      { id: "a", from: "me", text: "Loved the rooftop short. What LUT was that?", at: "Yesterday" },
      { id: "b", from: "them", text: "Custom one — I'll send it over tonight.", at: "Yesterday" },
    ],
  },
  {
    id: "t3",
    creatorId: "c5",
    unread: 1,
    messages: [{ id: "a", from: "them", text: "Hackathon team is forming. You in?", at: "Mon" }],
  },
];

export type Place = {
  id: string;
  name: string;
  category: string;
  distance: string;
  rating: number;
  x?: number;
  y?: number;
  open?: boolean;
  blurb: string;
  mapsUrl?: string;
  lat?: number;
  lon?: number;
};
export const places: Place[] = [
  {
    id: "pl1",
    name: "Kenyatta Night Market",
    category: "Food",
    distance: "0.8 km",
    rating: 4.7,
    x: 32,
    y: 38,
    open: true,
    blurb: "Street grills, live music after 8pm.",
  },
  {
    id: "pl2",
    name: "Upper Hill Rooftop",
    category: "Views",
    distance: "1.4 km",
    rating: 4.5,
    x: 58,
    y: 26,
    open: true,
    blurb: "Sunset spot, popular with creators.",
  },
  {
    id: "pl3",
    name: "The Loop Studio",
    category: "Dance",
    distance: "2.1 km",
    rating: 4.8,
    x: 70,
    y: 60,
    open: false,
    blurb: "Drop-in dance classes, Thu–Sun.",
  },
  {
    id: "pl4",
    name: "iHub Co-work",
    category: "Tech",
    distance: "3.0 km",
    rating: 4.4,
    x: 22,
    y: 70,
    open: true,
    blurb: "Meetups, fast Wi-Fi, coffee.",
  },
  {
    id: "pl5",
    name: "Java Riverside",
    category: "Cafe",
    distance: "1.1 km",
    rating: 4.3,
    x: 46,
    y: 52,
    open: true,
    blurb: "Quiet tables and good flat whites.",
  },
  {
    id: "pl6",
    name: "Karura Forest Gate",
    category: "Outdoors",
    distance: "5.6 km",
    rating: 4.9,
    x: 82,
    y: 18,
    open: true,
    blurb: "Trails, waterfalls, cycling.",
  },
];

export type Title = {
  id: string;
  title: string;
  genre: string;
  year: number;
  image: string;
  length: string;
  live?: boolean;
  progress?: number;
};
export const catalog: Title[] = [
  {
    id: "w1",
    title: "Last Light, Mara",
    genre: "Documentary",
    year: 2026,
    image: m4,
    length: "52m",
    progress: 40,
  },
  { id: "w2", title: "Neon Nairobi", genre: "Series", year: 2026, image: m1, length: "S1 · 8 eps" },
  {
    id: "w3",
    title: "Midnight Grill",
    genre: "Food",
    year: 2025,
    image: m2,
    length: "24m",
    progress: 75,
  },
  { id: "w4", title: "Motion Theory", genre: "Music", year: 2026, image: m3, length: "38m" },
  {
    id: "w5",
    title: "Creator Live: Q&A",
    genre: "Live",
    year: 2026,
    image: m3,
    length: "Live",
    live: true,
  },
  {
    id: "w6",
    title: "City Pulse Live",
    genre: "Live",
    year: 2026,
    image: m1,
    length: "Live",
    live: true,
  },
];

export type Txn = { id: string; label: string; amount: number; at: string; kind: "in" | "out" };
export const seedTxns: Txn[] = [
  { id: "x1", label: "Tip from @zuri.moves fans", amount: 1250, at: "Today, 09:12", kind: "in" },
  { id: "x2", label: "Night Market — mshikaki", amount: -480, at: "Yesterday, 21:40", kind: "out" },
  { id: "x3", label: "Creator payout (demo)", amount: 8400, at: "Mon, 14:00", kind: "in" },
  { id: "x4", label: "Sent to Kibet", amount: -1500, at: "Sun, 11:23", kind: "out" },
];

export const fmtKES = (n: number) =>
  `KES ${Math.abs(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const compact = (n: number) => Intl.NumberFormat("en", { notation: "compact" }).format(n);
