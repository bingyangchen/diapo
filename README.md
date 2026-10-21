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
| `make lint` | Run `lint-md`, then check the code with ESLint and Prettier |
| `make lint-md` | Check the Markdown with markdownlint |
| `make format` | Fix what ESLint, Prettier, and markdownlint can fix automatically |
| `make typecheck` | Type-check the browser code and the Node code |
| `make test` | Run the Vitest unit and integration tests |
| `make e2e` | Build the fixture decks and run the Playwright tests in all three browsers |
| `make check-scenarios` | Check that every scenario in `docs/specs/` has a test or a manual check in `tests/manual/` |
| `make check` | Run `lint`, `check-scenarios`, `typecheck`, and `test` in order |

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

To reveal content step by step, wrap it in `Step` with the step it appears at. A component that changes in other ways reads the current step with `useStep`, listing every step at which it changes:

```tsx
import { Step, useStep } from "#diapo";

export default function Agenda() {
  const step = useStep(3);
  return (
    <div className="flex flex-col gap-8">
      <Step at={1}>
        <p>Appears at step 1</p>
      </Step>
      <Step at={2}>
        <p>Appears at step 2</p>
      </Step>
      <p>{step < 3 ? "Before step 3" : "From step 3 on"}</p>
    </div>
  );
}
```

Space items with `gap`, not `space-y-*`, which skips items inside a `Step`. The full rules are in `docs/specs/steps.md`.

Speaker notes are a Markdown string exported as `notes`, which the presenter window shows. Write them as a template literal, escaping backticks as `` \` ``, `${` as `\${`, and every backslash as `\\`. The build fails on notes that break these rules and names the file and the fix:

```tsx
export const notes = `
- Ask who has used Keynote
- Stress that \`useStep\` lists every step
`;
```

A slide that re-exports another one leaves out its notes unless it lists them: `export { default, notes } from "./agenda";`. Notes ship in the slidetray, so anyone who opens a published deck can read them. The full rules are in `docs/specs/framework.md`.

## Playing a Deck

- **Online:** open the deck from <https://bingyangchen.github.io/diapo/>.
- **On your laptop without a network:** run `make build`, then `make serve`.
- **On a venue computer from a USB drive:** run `make build`, copy `dist/<deck-id>/` to the drive, and open its `index.html` in a browser.

While a deck plays, the URL hash names the current slide and step (`#/intro`, or `#/intro/2` from step 1 on), so a reload or a shared link opens the same screen. Next plays the current slide's remaining steps before moving on, and Previous from a slide's start lands on the previous slide's last step. A presenter remote works like a keyboard:

| Action | Keys |
| --- | --- |
| Next step | →, ↓, Page Down, Space, Enter, or swipe left |
| Previous step | ←, ↑, Page Up, Shift+Space, Backspace, or swipe right |
| First or last slide | Home or End |
| Go to slide _n_ | Type _n_, then Enter |
| Black screen | B or . |
| Fullscreen | F, F5, or the button in the bottom-right corner |
| Overview | G, or the overview button in the bottom-right corner |
| Presenter window | S |

After Home, End, a typed slide number, or a slide chosen in the overview, the browser's back button returns to the slide and step you jumped from.

The overview shows every slide as a thumbnail of its last step, four to a row. Move the selection with the arrow keys and press Enter, click a thumbnail, or type a slide number and press Enter to jump to that slide's first step; G or the button closes the overview without jumping. While the overview is open, use the keyboard, the mouse, or touch: a presenter remote's Page Up and Page Down only scroll the overview, and its black screen key does nothing. The full rules are in `docs/specs/overview.md`.

### Presenter Mode

Press S in the window that plays the deck to open the presenter window, which shows the current slide, the next step, the next slide, the speaker notes, the elapsed time, and the time of day. Keys and the presenter remote work in either window, and both windows follow the same slide. While the presenter window is open, the overview shows only there and the projector keeps showing the current slide; keys pressed in either window still move through that overview. After either window reloads, they reconnect on their own.

1. Connect the projector and set the displays to extend the desktop, not to mirror it. On macOS, keep "Displays have separate Spaces" on in System Settings > Desktop & Dock, or a window going fullscreen on one display blacks out the other.
2. Press S, then drag the deck window to the projector and press F there. The presenter window stays on your laptop.

If the deck window is already on the projector when you press S, for example after closing the presenter window by mistake, the presenter window opens on the projector too; drag it back to your laptop. S does nothing while the deck window is in fullscreen, so press Esc first. In Chrome, after the deck window reloads, click an empty spot on the deck window before clicking its Back button; otherwise, after a jump made in the presenter window, the Back button skips every slide of the deck and returns to the page you opened the deck from. The full rules are in `docs/specs/presenter.md`.

## Deployment

Every merge into `main` runs `make build-site` and deploys `dist/` to GitHub Pages.

## Documentation

This repository follows spec-driven development; see `AGENTS.md`.

- `docs/specs/` describes what the code on `main` implements.
- `docs/plans/` holds approved changes, and `docs/plans/roadmap.md` shows what comes next.
- `tests/manual/` holds the steps for the scenarios that need a manual check.
