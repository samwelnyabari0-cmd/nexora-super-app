const MAX_HTML_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "").trim() : null;
}

function isAllowedHost(hostname: string, allowedHosts: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowedHosts.some((allowed) => host === allowed || host.endsWith("." + allowed));
}

function safeArticleUrl(value: string, base: string, allowedHosts: string[]): URL | null {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password || !isAllowedHost(url.hostname, allowedHosts)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function extractPublisherImage(html: string, pageUrl: string): string | null {
  const metaTags = [...html.slice(0, MAX_HTML_BYTES).matchAll(/<meta\\b[^>]*>/gi)].map((match) => match[0]);
  const accepted = new Set(["og:image", "og:image:url", "twitter:image", "twitter:image:src", "image"]);
  for (const tag of metaTags) {
    const key = (attribute(tag, "property") ?? attribute(tag, "name") ?? attribute(tag, "itemprop") ?? "").toLowerCase();
    if (!accepted.has(key)) continue;
    const raw = attribute(tag, "content");
    if (!raw) continue;
    try {
      const image = new URL(raw, pageUrl);
      if (image.protocol !== "https:" || !image.hostname || image.username || image.password) continue;
      if (image.hostname === "localhost" || image.hostname.endsWith(".local") || image.hostname.endsWith(".internal")) continue;
      return image.toString();
    } catch {
      continue;
    }
  }

  const imageSource = [...html.slice(0, MAX_HTML_BYTES).matchAll(/<link\\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => (attribute(tag, "rel") ?? "").toLowerCase().split(/\\s+/).includes("image_src"));
  const raw = imageSource ? attribute(imageSource, "href") : null;
  if (!raw) return null;
  try {
    const image = new URL(raw, pageUrl);
    return image.protocol === "https:" && image.hostname && !image.username && !image.password
      ? image.toString()
      : null;
  } catch {
    return null;
  }
}

export async function fetchPublisherImage(
  articleUrl: string,
  allowedHosts: string[],
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  let current = safeArticleUrl(articleUrl, articleUrl, allowedHosts);
  if (!current) return null;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetcher(current.toString(), {
      redirect: "manual",
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9",
        "user-agent": "NexoraNewsImageBot/1.0",
      },
      signal: AbortSignal.timeout(6_000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) return null;
      const next = safeArticleUrl(location, current.toString(), allowedHosts);
      if (!next) return null;
      current = next;
      continue;
    }

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\\/html|application\\/xhtml\\+xml/i.test(contentType)) return null;
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_HTML_BYTES) return null;
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return extractPublisherImage(html, current.toString());
  }
  return null;
}
