import type { SiteDeck } from "virtual:site";

export function Home({ decks }: { decks: SiteDeck[] }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">diapo</h1>
      <ul className="mt-8 space-y-3">
        {decks.map((deck) => (
          <li key={deck.id}>
            {/* `index.html` is explicit because `file://` does not resolve a directory to it. */}
            <a
              className="text-lg text-blue-700 underline"
              href={`${deck.id}/index.html`}
            >
              {deck.title}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
