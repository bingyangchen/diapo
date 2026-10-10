# diapo

diapo is a slide player and slide framework built on static web pages. Each slide is a React component styled with Tailwind CSS, and each deck builds into a _slidetray_: a self-contained directory that plays from GitHub Pages, from a static server on your laptop, or by opening its `index.html` straight from a USB drive with no network.

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm, at the version in the `packageManager` field of `package.json` (`corepack enable` sets it up)

## Getting Started

```sh
make install           # dependencies and the Playwright browsers
make dev DECK=example  # live preview of decks/example
```

## Commands

| Command | What it does |
| --- | --- |
| `make install` | Install dependencies, including Chromium, Firefox, and WebKit for Playwright |
| `make dev DECK=<deck-id>` | Start the Vite dev server with a live preview of one deck |
| `make build` | Build a slidetray for every deck, plus the site's home page, into `dist/` |
| `make build-site` | Build what gets deployed: skip unpublished decks and warn when the site nears the GitHub Pages size limit |
| `make serve` | Serve `dist/` with a local static server |
| `make lint` | Check the code with ESLint and Prettier |
| `make format` | Fix what ESLint and Prettier can fix automatically |
| `make typecheck` | Type-check the browser code and the Node code |
| `make test` | Run the Vitest unit and integration tests |
| `make e2e` | Build the fixture decks and run the Playwright tests in all three browsers |
| `make check` | Run `lint`, `typecheck`, and `test` in order |

`make dev`, `make build`, and `make build-site` read decks from `decks/`. Pass `DECKS_DIR=tests/fixtures/decks` to work on the player against the test decks.

## Writing a Deck

A deck is a directory under `decks/`, and the directory name is its deck ID:

```text
decks/<deck-id>/
├── deck.json
├── slides/
│   └── <slide-id>.tsx
└── assets/
```

`deck.json` holds the title, whether the deck is published to the site, and the slide order:

```json
{
  "title": "My Talk",
  "publish": false,
  "slides": [
    "intro",
    "agenda"
  ]
}
```

`publish` defaults to `true`. Unknown fields fail the build, so a misspelled `publish` never puts a private deck on the site.

Each slide default-exports a React component that fills the 1920×1080 canvas:

```tsx
import photo from "../assets/photo.jpg";

export default function Intro() {
  return (
    <div className="flex h-full items-center justify-center">
      <img src={photo} alt="" />
    </div>
  );
}
```

Deck IDs and slide IDs use lowercase letters, digits, and hyphens. Every file in a deck must be 25 MiB or smaller.

Each slide ID can appear in `slides` only once. To show a slide twice, add a file that re-exports it and list the new slide ID:

```tsx
// slides/agenda-recap.tsx
export { default } from "./agenda";
```

## Playing a Deck

- **Online:** open the deck from <https://bingyangchen.github.io/diapo/>.
- **On your laptop without a network:** run `make build`, then `make serve`.
- **On a venue computer from a USB drive:** run `make build`, copy `dist/<deck-id>/` to the drive, and open its `index.html` in a browser.

## Deployment

Every merge into `main` runs `make build-site` and deploys `dist/` to GitHub Pages.

## Documentation

This repository follows spec-driven development; see `AGENTS.md`.

- `docs/specs/` describes what the code on `main` implements.
- `docs/plans/` holds approved changes, and `docs/plans/roadmap.md` shows what comes next.
