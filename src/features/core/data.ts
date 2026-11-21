import m1 from "@/assets/media-1.jpg";
import m2 from "@/assets/media-2.jpg";
import m3 from "@/assets/media-3.jpg";
import m4 from "@/assets/media-4.jpg";

export const media = { m1, m2, m3, m4 };

export type Creator = { id: string; name: string; handle: string; hue: number; verified?: boolean };
export type Post = {
  id: string;
  creatorId: string;
  creatorName?: string;
  creatorHandle?: string;
  creatorAvatarUrl?: string | null;
  kind: "short" | "video" | "post";
  image?: string;
  mediaType?: string;
  mediaPostId?: string;
  mediaStorageProvider?: "supabase" | "r2" | null;
  filter?: string;
  format?: string;
  aspectRatio?: string | null;
  frameRatio?: string | null;
  focalX?: number;
  focalY?: number;
  zoom?: number;
  dominantColor?: string | null;
  thumbnailUrl?: string;
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

export const creators: Creator[] = [];

export const creatorById = (id: string): Creator => creators.find((creator) => creator.id === id) ?? { id, name: "NEXORA member", handle: "", hue: 295 };

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
  country?: string;
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
