// Provider adapters. Every domain talks to an adapter interface; today all are
// demo implementations. Swap in real providers here without touching UI code.

export type ProviderStatus = { id: string; domain: string; label: string; mode: "demo" | "live" };

export const providers: ProviderStatus[] = [
  { id: "ai", domain: "AI", label: "Demo assistant (scripted)", mode: "demo" },
  { id: "maps", domain: "Maps", label: "Simulated map & places", mode: "demo" },
  { id: "stream", domain: "Watch", label: "Demo catalogue", mode: "demo" },
  { id: "wallet", domain: "Wallet", label: "Mock ledger — no real money", mode: "demo" },
  { id: "msg", domain: "Messages", label: "Local-only chat", mode: "demo" },
];

export interface AIProvider {
  reply(prompt: string): Promise<string>;
}

export const demoAI: AIProvider = {
  async reply(prompt) {
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));
    const p = prompt.toLowerCase();
    if (p.includes("caption"))
      return 'Here are 3 caption ideas:\n1. "Golden hour, city edition."\n2. "Nairobi never sleeps — neither do I."\n3. "Shot on phone, graded with love."';
    if (p.includes("near") || p.includes("food") || p.includes("eat"))
      return "Based on your Pulse Passport interests (food, nearby), Kenyatta Night Market (0.8 km, ★4.7) is trending tonight. Want me to open it in Maps?";
    if (p.includes("money") || p.includes("wallet") || p.includes("send"))
      return "You can send money from the Wallet tab. Remember: in this demo, transfers only update a mock ledger — no real funds move.";
    if (p.includes("summar"))
      return "Summary: your feed today leaned toward city shorts and food creators. Engagement on your posts is up 12% vs last week (demo figures).";
    return `I'm the NEXORA demo assistant. I can draft captions, suggest nearby places, or summarise your feed. You asked: "${prompt}". Connect a real AI provider to get genuine answers.`;
  },
};

export function simulatedPlaceSearch<T extends { name: string; category: string }>(
  items: T[],
  q: string,
) {
  return new Promise<T[]>((resolve, reject) => {
    setTimeout(() => {
      if (q.trim().toLowerCase() === "error") reject(new Error("Simulated network error"));
      const s = q.trim().toLowerCase();
      resolve(s ? items.filter((i) => `${i.name} ${i.category}`.toLowerCase().includes(s)) : items);
    }, 550);
  });
}
