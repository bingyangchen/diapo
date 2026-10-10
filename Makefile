DECKS_DIR ?= decks
DECK ?=

BUILD = node src/build/cli.ts

.PHONY: install dev build build-site serve lint format typecheck test e2e check

install:
	pnpm install
	pnpm exec playwright install $(if $(CI),--with-deps) chromium firefox webkit

dev:
	$(BUILD) dev --decks-dir $(DECKS_DIR) $(if $(DECK),--deck $(DECK))

build:
	rm -rf dist
	$(BUILD) build --decks-dir $(DECKS_DIR) --out-dir dist

build-site:
	rm -rf dist
	$(BUILD) build --decks-dir $(DECKS_DIR) --out-dir dist --site

serve:
	pnpm exec vite preview --outDir dist

lint:
	pnpm exec eslint .
	pnpm exec prettier --check .

format:
	pnpm exec eslint --fix .
	pnpm exec prettier --write .

typecheck:
	pnpm exec tsc --noEmit -p tsconfig.app.json
	pnpm exec tsc --noEmit -p tsconfig.node.json

test:
	pnpm exec vitest run

# Builds the fixture decks first (see tests/e2e/global-setup.ts), since only the build
# output shows whether a deck plays from `file://`.
e2e:
	pnpm exec playwright test

check: lint typecheck test
