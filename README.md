# PetClinic Playwright E2E Framework

[![Playwright Tests](https://github.com/sid0701/petclinic-pw-pom/actions/workflows/playwright.yml/badge.svg)](https://github.com/sid0701/petclinic-pw-pom/actions/workflows/playwright.yml)

End-to-end UI tests for the [PetClinic](https://petclinic.bondaracademy.com) web application, written in
**Playwright + TypeScript** using a **Page Object Model** architecture.

The suite started from the practice assignments of Bondar Academy's
[Playwright UI Testing Mastery](https://bondaracademy.com/programs/playwright-ui-testing-mastery) program and
was restructured from flat spec files into a framework with page objects, API-backed cleanup fixtures and a
CI pipeline. The flat-spec version is kept in [petclinic-pw](https://github.com/sid0701/petclinic-pw) for
comparison.

---

## Highlights

- **Page Object Model with a single `pom` fixture.** A `PageManager` builds every page object, so tests never
  construct pages themselves and read as *action → action → validation*.
- **Self-cleaning tests.** Custom fixtures snapshot data through the PetClinic REST API before a test and
  restore it afterwards, **even when the test fails**, so the shared environment stays consistent.
- **Log in once per run.** Global setup signs in, saves the browser session (`storageState`) and captures the
  API bearer token used by the fixtures.
- **No hard waits.** Only web-first assertions, auto-waiting locators and `expect.poll`.
- **CI on every pull request.** GitHub Actions type-checks, lints and format-checks the code, then runs the
  suite in the official Playwright container and keeps traces of failed tests as downloadable artifacts.
- **Strict code quality.** TypeScript `strict` mode, ESLint with `typescript-eslint` (type-aware) and
  `eslint-plugin-playwright` (e.g. missing `await`, hard waits, focused tests), and Prettier formatting.

## Tech Stack

| | |
| --- | --- |
| Test runner | [Playwright Test](https://playwright.dev) 1.64 |
| Language | TypeScript on Node.js 24 |
| CI | GitHub Actions + `mcr.microsoft.com/playwright` container |
| Code quality | TypeScript `strict`, ESLint 9 (`typescript-eslint`, `eslint-plugin-playwright`), Prettier |
| Config | `dotenv` for local credentials, GitHub repository secrets in CI |

---

## What's Covered

19 tests across 5 spec files:

| Spec | Area | Scenarios |
| --- | --- | --- |
| `input-fields.spec.ts` | Pet types: editing | Rename and rename back, cancel an edit, required-name validation |
| `dialog-boxes.spec.ts` | Pet types: delete dialog | Accept the confirmation to delete, dismiss it to keep the pet type |
| `checkboxes.spec.ts` | Vet specialties dropdown | Check selected specialties, select all, unselect all |
| `lists-and-dropdowns.spec.ts` | Pet type select | Selected pet type in the list, update a pet's type |
| `web-tables.spec.ts` | Owners & veterinarians tables | Owner details, city filtering, search by last name (incl. no results), search by phone; renamed, added and deleted specialties shown on vets |

---

## Architecture

```
tests/*.spec.ts ──uses──▶ pom fixture ──▶ PageManager ──▶ page objects (playwright-utils/pages)
        │
        └──requests──▶ restore* fixtures ──▶ PetClinic REST API (snapshot before, restore after)
```

### Page objects

Each page or major component is one class in `playwright-utils/pages/`, following a few rules:

- Locators are written **inline in methods**, not stored as class properties.
- A method covers a **whole user task** (e.g. `addNewPetType`), never a single click.
- A method only acts on **its own page**. Navigating to another page ends the method.
- Actions finish with a **stabilising check** (e.g. the form closed). The test's **goal assertions** live in
  separate `expect*` methods.

A test then reads like the user story:

```ts
test('User can add a pet type and delete it by accepting the confirmation dialog', async ({ pom }) => {
    const petType = `pig-${Date.now()}`
    await pom.petTypesPage.addNewPetType(petType)
    await pom.petTypesPage.expectPetTypeAtLastRow(petType)
    const dialogMessage = await pom.petTypesPage.deletePetType(petType)
    await pom.petTypesPage.expectDeleteDialogMessage(dialogMessage, 'Delete the pet type?')
    await pom.petTypesPage.expectPetTypeNotListed(petType)
})
```

### Cleanup fixtures

The tests run against a **shared, live** environment, so every test that changes data requests a fixture that
puts it back:

| Fixture | Restores |
| --- | --- |
| `restorePetTypes` | Renamed pet types; deletes pet types the test added |
| `restoreSpecialty` | Renamed specialties; deletes specialties the test added |
| `restoreVetSpecialties` | Each vet's assigned specialties |
| `restorePetTypeOfPets` | Each pet's type |

Each one reads the current data from the API, runs the test with `use()`, then compares and restores. The
teardown runs whether the test passed or failed.

### Authentication

`.auth/auth-setup.ts` runs once before the suite (`globalSetup`):

1. Checks that `EMAIL` and `PASSWORD` are set, and stops with a clear error if not.
2. Signs in through the UI and saves the session to `.auth/user.json`, which every test starts from.
3. Captures the access token from the `/token` response. The config sends it as an `Authorization: Bearer`
   header, so fixtures can call the API directly.

---

## Getting Started

### Prerequisites

- Node.js 24+
- A Bondar Academy account (the PetClinic app requires a login)

### Setup

```bash
npm ci
npx playwright install chromium
cp .env-SAMPLE .env     # then add your EMAIL and PASSWORD
```

```ini
EMAIL='your.email@example.com'
PASSWORD='your-password'
```

`.env` is git-ignored, so credentials never leave your machine.

### Running Tests

| Command | Description |
| --- | --- |
| `npm test` | Run the whole suite |
| `npx playwright test tests/web-tables.spec.ts` | Run one spec file |
| `npx playwright test -g "pet type"` | Run tests whose title matches |
| `npx playwright test --ui` | Open UI mode |
| `npx playwright test --headed` | Watch the browser |
| `npx playwright show-report` | Open the last HTML report |
| `npm run typecheck` | Type-check with `tsc` (Playwright itself doesn't check types) |
| `npm run lint` / `npm run lint:fix` | Run ESLint / fix what it can |
| `npm run format` / `npm run format:check` | Format with Prettier / check formatting |

Tests run one at a time (`workers: 1`), because they share data on the live environment.

---

## Continuous Integration

[`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) runs on every pull request to `main`, on
every push to `main`, and on demand from the Actions tab.

- Runs inside `mcr.microsoft.com/playwright:v1.64.1-noble`, so browsers are already installed.
- Type check, lint and format check run first, so they fail in seconds before the test run starts.
- Credentials come from the `EMAIL` / `PASSWORD` repository secrets.
- In CI, Playwright keeps a **trace for every failed test** and prints results to the job log.
- The `test-results` (traces) and `playwright-report` artifacts are kept for 7 days.
- A `concurrency` group allows only one run at a time and never cancels a run in progress, so cleanup
  fixtures always finish.

---

## Roadmap

Planned next steps toward a framework that scales to a larger suite and team:

- [ ] **Parallel runs:** unique test data per test (`@faker-js/faker`), so tests no longer share records and
      `workers: 1` can be lifted
- [ ] **API layer:** API client classes, one shared snapshot-and-restore helper in place of the four restore
      fixtures, and dedicated API tests
- [x] **Code quality in CI:** ESLint with `eslint-plugin-playwright`, Prettier and TypeScript `strict` mode
- [ ] **Test tags:** `@smoke` for fast PR checks, `@regression` for the full suite
- [ ] **Multiple environments:** `baseURL` and credentials chosen per environment (`.env.qa`, `.env.staging`)
- [ ] **Wider coverage:** Firefox and WebKit projects, accessibility checks with `@axe-core/playwright`

---

## Project Structure

```
.
├── .auth/
│   └── auth-setup.ts            # Global setup: credential check, sign-in, session + API token
├── .github/workflows/
│   └── playwright.yml           # CI pipeline
├── playwright-utils/
│   ├── fixtures/
│   │   ├── custom-fixtures.ts   # `pom` fixture + API-backed restore fixtures
│   │   └── page-manager.ts      # Builds every page object
│   ├── helpers/
│   │   └── api-urls.ts          # PetClinic API base URL
│   └── pages/                   # 10 page and component objects
├── test-data/                   # JSON test data
├── tests/                       # Spec files
├── .env-SAMPLE                  # Credentials template
├── eslint.config.mjs            # ESLint rules (TypeScript + Playwright)
├── .prettierrc.json             # Prettier formatting rules
├── playwright.config.ts
└── tsconfig.json                # TypeScript strict mode
```
