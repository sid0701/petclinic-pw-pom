# Changelog

Corrections and changes Claude Code makes to this project, grouped by date (newest first).

Each entry lists the files changed, what changed, why, and how it was verified. Entries from 2026-11-02 onwards use this detailed format; older entries are shorter.

---

## 2026-11-05

### Added: global setup fails fast when `EMAIL` or `PASSWORD` is missing

- **Files:** `.auth/auth-setup.ts`
- **What changed:** before reading `user.json` or launching the browser, `browserAuthorize` checks that `EMAIL` and `PASSWORD` are set and not empty. If either is missing it throws `Missing required credentials: <names>. Set them in .env locally, or as repository secrets for GitHub Actions.`
- **Why:**
  - In CI the values come from repository secrets. An undefined secret becomes an empty string, and `process.env.EMAIL!` only satisfies TypeScript.
  - Login then fails, and the run only shows a timeout from `waitForResponse('**/token')`, which doesn't point to the cause.
  - A blank value counts as missing for the same reason.
- **Verified:**
  - `EMAIL= npx playwright test tests/checkboxes.spec.ts` stops in global setup with `Missing required credentials: EMAIL`, and with both blank it lists `EMAIL, PASSWORD`. No browser is launched and no tests run. A blank value is kept because dotenv doesn't overwrite a variable that's already set.
  - With `.env` loaded normally, `tests/checkboxes.spec.ts` passes 3 of 3 against the live app.

### Added: GitHub Actions pipeline that runs the Playwright suite

- **Files:** `.github/workflows/playwright.yml` (new), `playwright.config.ts`, `package.json`
- **What changed:**
  - **Workflow `Playwright Tests`:**
    - Runs on push to `main`, on pull requests to `main`, and manually (`workflow_dispatch`). There is no nightly schedule.
    - Runs inside `mcr.microsoft.com/playwright:v1.64.1-noble`, which already has the browsers and their system packages. The tag matches `@playwright/test` 1.64.1 in `package-lock.json`.
    - Steps: `npm ci`, then `npm test` with `EMAIL` / `PASSWORD` taken from repository secrets.
    - Uploads `test-results/` (artifact `test-results`) and `playwright-report/` (artifact `playwright-report`) for 7 days, unless the run was cancelled.
    - `concurrency: petclinic-e2e` with `cancel-in-progress: false`, plus a 30-minute job timeout.
  - **`playwright.config.ts`:** when `CI` is set:
    - `trace` is `retain-on-failure` instead of `on-first-retry`.
    - The reporter is `list` + `html` (`open: 'never'`) instead of `html` alone.
    - Local runs behave as before.
  - **`package.json`:** added `"test": "playwright test"`.
- **Why:**
  - **Trace:** `retries` is 0, so `on-first-retry` never records a trace. A CI failure would leave nothing for the `pw-debug-actions` skill, which downloads the `test-results` artifact.
  - **Reporter:** `list` prints each test's result in the job log, and `open: 'never'` stops the HTML reporter trying to open a browser.
  - **Concurrency:** the specs rename and delete data on the shared live site. Two runs at the same time (e.g. a push to `main` and a PR) could break each other. Cancelling a run partway could skip a fixture's cleanup, so later runs wait instead.
  - **Container image:** fixes the OS and browser environment and skips installing browsers on every run. A Dockerfile isn't needed (see `QA.md`).
  - **Triggers:** running on every branch push plus PRs would test the same change twice.
- **Verified:**
  - `CI=1 npx playwright test --list` loads the config and lists 19 tests in 5 files.
  - The workflow itself hasn't run yet. It needs the `EMAIL` and `PASSWORD` repository secrets and a PR to `main` (or a manual run once the file is on `main`).

---

## 2026-11-04

### Changed: new-specialty test split in two, fixed the dropdown options check, added cleanup fixtures and removed races

- **Files:** `tests/web-tables.spec.ts`, `playwright-utils/pages/specialties-page.ts`, `playwright-utils/pages/edit-veterinarians-page.ts`
- **What changed:**
  - **Spec:** `New added speciality can be selected from sepciality dropdown` was split into two tests. Both request `restoreSpecialty, restoreVetSpecialties`, and both first check that Sharon Jenkins has no specialties.
    - **`Newly added specialty can be assigned to a vet`:** add `oncology`, check it's listed, read all names, open the vet, check the dropdown offers exactly those names, select `oncology`, save, then check the vets list.
    - **`Deleted specialty no longer shows on vets`:** add, assign, save, delete, check it's not listed, then check Sharon has none again.
  - **`SpecialtiesPage`:**
    - `readSpecialtiesValues` (unscoped `getByRole('textbox')`) was replaced by `readAllSpecialtyNames()`. It waits for the row values and then reuses the private, row-scoped `readSpecialtyValues()`.
    - `addNewSpecialty` now checks the `New Specialty` heading after Add and checks the form is gone after Save. It also has the `#name` comment from `PetTypesPage`.
  - **`EditVeterinarianPage`:**
    - New private `openSpecialitiesDropdown()`, used by `expectSelectedSpecialities`, `updateSpecialities` and `expectSpecialityOptions`. It opens the dropdown with the always-visible `▼` arrow (`getByText('▼')`) instead of `.selected-specialties`.
    - `updateSpecialities` now closes the dropdown at the end and checks the options are hidden.
    - `expectAllSpecialties(allSpecialties)` was replaced by `expectSpecialityOptions(...specialities)`. It reads the checkbox ids, sorts them and compares with `expect.poll`.
    - `clickSave` was renamed to `saveVeterinarian`.
- **Why:**
  - **Broken assertion:** on the live app, `.dropdown-content` is one wrapper, so `allInnerTexts()` returned `["radiologysurgerydentistry"]`. That could never equal the list of names. It was also a non-retrying `expect` on a CSS class. Each option is a checkbox whose `id` is the name, which `expectSelectedSpecialities` already relies on.
  - **Cleanup on failure:** the test created `oncology` and assigned it to Sharon, and only removed it at the end. A failure partway left data on the shared server. `restoreVetSpecialties` is requested last, so it tears down first: the vet is restored before the added specialty is deleted.
  - **One flow per test:** assigning a new specialty and deleting one are separate behaviours.
  - **Races:**
    - `addNewSpecialty` stopped once the POST succeeded, and the read guard only checked the first row. The names could be captured before `oncology` rendered.
    - With the Add form open there are 4 textboxes but only 3 inside rows, which is why the read is now row-scoped.
  - **Dropdown toggle:** `.selected-specialties` is an empty, zero-size span when a vet has no specialties, so it can't be clicked. This made the new tests and `checkboxes.spec.ts` › `Unselect all specialities` fail once the shared helper used it. A probe confirmed the `▼` arrow opens and closes the dropdown.
  - **Closing the dropdown:** with four options the open list covers the Save button, and the first run timed out on that click.
  - **Names:** fixed the "sepciality" typo. `saveVeterinarian` describes the user task, and `expectSpecialityOptions` says what it checks.
- **Verified:**
  - `npx playwright test tests/web-tables.spec.ts tests/checkboxes.spec.ts` passes 12 of 12 against the live app.
  - A second run of the Veterinarians tests passed, and a probe (deleted afterwards) listed only `radiology, surgery, dentistry`. That confirms the fixtures cleaned up after the earlier failed run as well.

### Changed: pet type tests assert names listed or not listed instead of a DOM row id

- **Files:** `playwright-utils/pages/pet-types-page.ts`, `tests/input-fields.spec.ts`
- **What changed:**
  - `openEditPetType` no longer reads the input's `id` attribute and no longer returns it.
  - `expectPetTypeAtRow(rowId, petType)` was replaced by `expectPetTypeListed(petType)`, which uses `expect.poll` over `readPetTypeValues()`. `expectPetTypeNotListed` now has a custom message as well.
  - `input-fields.spec.ts`:
    - The `const rowId = …` lines are gone.
    - Rename: after each rename it checks the new name is listed and the old one isn't.
    - Cancel: checks `dog` is listed and `moose` isn't.
    - Blank name: checks `lizard` is listed.
- **Why:**
  - The `id` is the row's position, not the pet type's database id. It moved a DOM detail between page objects and depended on the list order. This is the same problem fixed in `SpecialtiesPage`.
  - The name checks are stronger. "Old name not listed" catches a rename that adds a row instead of updating one. "`moose` not listed" catches a cancelled name that was saved anyway.
  - `expectPetTypeAtLastRow` is unchanged. It uses no DOM id, and "new pet type appears at the end" is what the add flow shows the user.
- **Verified:** `npx playwright test tests/input-fields.spec.ts tests/dialog-boxes.spec.ts` passes 5 of 5 against the live app. No `rowId` or `expectPetTypeAtRow` references remain.

### Changed: specialty rename test checks the vets list after the rename and asserts names, not row ids

- **Files:** `tests/web-tables.spec.ts`, `playwright-utils/pages/specialties-page.ts`, `playwright-utils/pages/pet-types-page.ts`
- **What changed:**
  - **Spec:**
    - The test `Veterinarians list shows each vet's specialities` became `Renamed specialty shows on the vets who have it`.
    - After the rename it now asserts `dermatology` is listed and `surgery` is not. It then opens Veterinarians again and asserts Rafael Ortega shows `dermatology`.
    - `restoreSpecialty` moved from the describe's `beforeEach` to the test's own parameters, with a comment like the one in `dialog-boxes.spec.ts`.
  - **`SpecialtiesPage`:**
    - `editSpecialty` was renamed to `openEditSpecialty` and no longer reads or returns the input's DOM `id`.
    - `expectSpecialtyAtRow(rowId, specialty)` was replaced by `expectSpecialtyListed(specialty)` and `expectSpecialtyNotListed(specialty)`. Both use `expect.poll` over the live input values, with custom messages.
    - The input-value read moved into a private `readSpecialtyValues()` helper with the "bound by Angular" comment, instead of being built again inline.
    - The pet-type comment left over from the copy is gone.
  - **Rows by role in both pages:** `locator('tbody tr')` became `getByRole('row').filter({ has: getByRole('textbox') })`, and the value reads use `getByRole('row').getByRole('textbox')`. In `PetTypesPage` this applies to `readPetTypeValues`, `findPetTypeRow` and `expectPetTypeAtLastRow`.
- **Why:**
  - **Missing goal check:** the test read the vets list before the rename but never after, so it didn't show the rename reaches the vets. Its name didn't describe the flow either.
  - **Restore fixture placement:** only this test in the describe changes data. In `beforeEach`, any later read-only test would pay for the snapshot and cleanup API calls.
  - **Accurate method name:** `editSpecialty` only opens the edit page. The name now matches `PetTypesPage.openEditPetType`.
  - **No row ids:** the row id is just the DOM index, so it leaked a DOM detail into the test and depended on list order. "New name listed, old name gone" is what the user sees.
  - **Rows by role:** the scripting rules don't allow structural CSS paths. Only body rows contain a textbox, so the filter skips the header row.
  - **Not done:** renaming a specialty created just for this test would mean assigning it to a vet, which still changes shared vet data. The restore fixture already undoes the rename, even after a failure.
- **Verified:**
  - `npx playwright test tests/web-tables.spec.ts tests/dialog-boxes.spec.ts tests/input-fields.spec.ts tests/checkboxes.spec.ts` passes 15 of 15 against the live app. `dialog-boxes` and `input-fields` cover the `PetTypesPage` locator change.
  - Running the rename test again passed. It first asserts Rafael Ortega has `surgery`, which confirms the fixture restored the name.

### Changed: vet specialities test checks the exact set of specialities, order-independent, without `nth-child`

- **Files:** `playwright-utils/pages/veterinarians-page.ts`, `tests/web-tables.spec.ts`
- **What changed:**
  - `expectSpeciality(vetName, speciality)` became `expectSpecialities(vetName, ...specialities)`.
    - The cell locator `locator('td:nth-child(2)')` became `.getByRole('cell').nth(1)`.
    - `toContainText` became `expect.poll` over the cell's `innerText()`, split on new lines, trimmed and sorted, then `toEqual` against the sorted expected names. It has a custom message, the same pattern as `EditVeterinarianPage.expectSelectedSpecialities`.
  - `editVeterinarian`: the row locator `getByRole('row', { name: \`${vetName}\` })` became the same exact-cell filter `expectSpecialities` uses. The redundant template literal is gone.
  - Spec: `openHome()` moved to a file-level `test.beforeEach`, so each describe's `beforeEach` only opens its own page. The describe `Testing Veterinarian Page` became `Veterinarians page`. The test `Correct speciality is associated with the Veterinarian ` (trailing space) became `Veterinarians list shows each vet's specialities`. The blank lines in the test body are gone. The call is now `expectSpecialities('Linda Douglas', 'surgery', 'dentistry')`.
- **Why:**
  - **Assertion was too loose:** `toContainText('surgery dentistry')` passed for extra specialities and for partial text (`'surg'`). It also depended on display order. A probe on the live app showed Linda Douglas renders `dentistry` then `surgery`, each in its own `<div>`, so the order is not stable. Vets with none have an empty cell, not "none".
  - **No column positions:** the scripting rules don't allow structural CSS paths. `nth(1)` on role `cell` keeps the locator role-based. The app source isn't available, so a `data-testid` can't be added. Columns are Name, Specialties, Edit, Delete.
  - **Exact row match in `editVeterinarian`:** the row's accessible name matches any substring of the whole row's text, so `Linda Douglas` would also match `Linda Douglass`.
  - **Naming:** "Specialities" and rest parameters match `EditVeterinarianPage`. The test name describes user behaviour, as the naming rule asks.
- **Verified:**
  - `npx playwright test tests/web-tables.spec.ts tests/checkboxes.spec.ts` passes 10 of 10 against the live app. `checkboxes.spec.ts` covers `editVeterinarian`.
  - A temporary negative spec (deleted afterwards) showed `('Linda Douglas', 'surgery')` and `('Linda Douglas', 'surg', 'dentistry')` now fail, and `('James Carter')` with no specialities passes.

### Changed: renamed the last-name search test to describe user behaviour

- **File:** `tests/web-tables.spec.ts`
- **What changed:** `Validate search by Last Name` became `Search by last name shows only matching owners`. The test body is unchanged.
- **Why:** the scripting rules ask for test names that describe user behaviour, not implementation. This was the last test in the spec with a "Validate…" name.
- **Verified:** `npx playwright test tests/web-tables.spec.ts` passes 6 of 6 against the live app.

### Changed: city methods on `OwnersPage` use role-based locators instead of `nth-child` column positions

- **Files:** `playwright-utils/pages/owners-page.ts`, `tests/web-tables.spec.ts`
- **What changed:**
  - `expectOwnerCountInCity`: `locator('tbody tr td:nth-child(3)').getByText(cityName, { exact: true })` became `getByRole('cell', { name: cityName, exact: true })`. The `:nth-child` comment was replaced with one explaining why the exact cell match only finds City cells.
  - `expectPetsInCity(cityName, petsName)` was renamed to `expectPetNamesInCity(cityName, petNames)`.
    - The row filter `has: locator('td:nth-child(3)').getByText(...)` became `has: getByRole('cell', { name: cityName, exact: true })`.
    - The pet locator `locator('td:nth-child(5) tr')` became `.getByRole('cell').getByRole('row')`.
    - The long line is split over two lines, the stray blank line is removed, and a comment was added.
  - Spec: `Validate owners count of the Madison city` became `Owners list shows the number of owners in Madison`. `Validate pets of the Madison City` became `Owners list shows the pets of owners in Madison` and calls the renamed method.
- **Why:**
  - **No column positions:** `nth-child(3)` and `nth-child(5)` depend on the column order. The scripting rules allow CSS only for scoping to stable tags, not structural paths. If a column were added or moved, the test would silently read the wrong column.
  - **Exact cell match:** no Name, Address or Telephone cell equals a city name exactly, so the match only finds City cells.
  - **Pet locator:** `.getByRole('cell').getByRole('row')` is the same pattern `openOwnerInformationByTelephone` uses, because only the Pets cell holds the nested pet rows.
  - **Names:** `petNames` matches `expectPetNames` and the rest of the file. The test names now describe user behaviour, as the naming rule asks.
  - A temporary probe test (deleted afterwards) confirmed on the live app that the old and new locators return the same pets, `["Leo","George","Mulligan","Freddy"]`, and that `getByRole('cell', { name: 'Madison', exact: true })` matches exactly 4 cells. The columns are Name, Address, City, Telephone, Pets.
- **Verified:** `npx playwright test tests/web-tables.spec.ts` passes 6 of 6 against the live app.

### Changed: merged `expectOwnerTelephone` into `expectOwnerInformation` with an options object

- **Files:** `playwright-utils/pages/owner-information-page.ts`, `tests/web-tables.spec.ts`
- **What changed:**
  - The signature went from `expectOwnerInformation(ownerName, ownerCity?)` to `expectOwnerInformation(ownerName, { city, telephone } = {})`.
  - The method builds `{ Name, City, Telephone }`, keyed by the owner table's row header texts. It loops over them and skips values that are `undefined`. Each check uses the same row-header locator: `getByRole('row').filter({ has: getByRole('rowheader', { name, exact: true }) }).getByRole('cell')`, then `toHaveText`. The heading check is unchanged.
  - Removed `expectOwnerTelephone`.
  - Spec: `('Jeff Black', 'Monona')` became `('Jeff Black', { city: 'Monona' })`. The telephone test now makes one call, `expectOwnerInformation(ownerName, { telephone })`, instead of two. `lists-and-dropdowns.spec.ts` passes only the name and needed no change.
- **Why:**
  - `expectOwnerTelephone` and the City check differed only in the row header and the value. The architecture rules say to parametrize instead of keeping two methods like that.
  - **Options object instead of a third positional parameter:** checking the phone without the city would otherwise need `(ownerName, undefined, telephone)`. Named keys make each call clear, and Address can be added later as one more key.
  - **The loop:** keeps one copy of the row-header locator instead of three.
  - **`=== undefined` instead of `if (ownerCity)`:** an empty string is no longer treated as "not passed".
- **Verified:** `npx playwright test tests/web-tables.spec.ts tests/lists-and-dropdowns.spec.ts` passes 7 of 7 against the live app.

### Changed: telephone test finds the owner by the exact phone cell, clicks the row's own link, and also checks the owner name

- **Files:** `playwright-utils/pages/owners-page.ts`, `playwright-utils/pages/owner-information-page.ts`, `tests/web-tables.spec.ts`
- **What changed:**
  - **Row locator:** `locator('tbody tr').filter({ has: getByText(telephone) })` became `getByRole('row').filter({ has: getByRole('cell', { name: telephone, exact: true }) })`.
  - **Shared navigation helper:** the click, the `GET /api/owners/<id>` response check and the URL check moved from `openOwnerInformation` into a new private method `openOwnerInformationFromLink(ownerLink: Locator)`. `openOwnerInformation(ownerName)` now passes its name link to it. Its behaviour is unchanged for existing callers.
  - **Telephone method:** renamed `openOwnerInformationUsingTelephone` to `openOwnerInformationByTelephone`. It now clicks `ownerRow.getByRole('link')` through the helper instead of reading the name and searching the table again. It reads the name with `innerText()` instead of `textContent()` + `!`, and returns `{ ownerName, petNames }` instead of only `petNames`.
  - **Spec:** the test is renamed to `Owner found by telephone shows the same phone and pets on Owner Information`. The number is stored once in `const telephone`, and the test now also calls `expectOwnerInformation(ownerName)`.
  - **`owner-information-page.ts`:** `expectOwnerTelephone` is split over two lines like `expectOwnerInformation`, and the three stray blank lines after it are removed.
- **Why:**
  - **Exact phone cell:** `getByText(telephone)` was a partial match anywhere in the row, so a shorter number could match another owner's row. `getByRole('row')` + `getByRole('cell')` is also higher in the project's locator priority than the CSS `tbody tr`. The nested pet rows have no telephone cell, so only the owner row matches.
  - **Click the row's link:** re-finding the link by name was a partial match across the whole table ("Jeff Black" would also match "Jeff Blackwell"). It also threw away the row already found. `textContent()` can return `null`, which the `!` hid. `innerText()` returns a string and gives the rendered text.
  - **Private helper:** keeps one copy of the navigation and its checks (the "reuse first" rule) without adding a public tiny method to the page object.
  - **Owner name check:** the project's cross-page content linking rule says to capture a value from the source page and assert it on the destination. `expectOwnerInformation` also checks the "Owner Information" heading, so the test confirms both the page and the owner.
  - **`const telephone` and the test name:** the value can't drift between the action and the check, and the name describes user behaviour as the naming rule asks.
- **Verified:** `npx playwright test tests/web-tables.spec.ts tests/lists-and-dropdowns.spec.ts` passes 7 of 7 against the live app. `lists-and-dropdowns` was included because it also calls `openOwnerInformation`. `npx tsc` isn't available (TypeScript isn't a direct dependency), so types were checked only by Playwright's transpile step.

### Changed: `expectPetNames` checks the pet names with one exact `toHaveText([...])` assertion

- **File:** `playwright-utils/pages/owner-information-page.ts`
- **What changed:** replaced the regex built from `petNames.join('|')`, the `petCells.first()` visibility guard and the `for ... of await petCells.all()` loop with one assertion: `toHaveText(petNames)` on every pet cell's `dt:text-is("Name") + dd`. The test itself is unchanged.
- **Why:**
  - The user wants the test to compare the pet names shown in the Owners list with those on the Owner Information page, not hard-coded values. The test already did that: `openOwnerInformationUsingTelephone` returns the list's names and `expectPetNames` checks them. Only the check was weak.
  - **One direction only:** the old loop confirmed each displayed pet was somewhere in the list, but not that every listed pet was displayed. A missing pet or a different count still passed.
  - **Loose match:** `toContainText(/a|b/i)` was a partial, case-insensitive match ("Leo" would accept "Leonardo"), and the names weren't escaped for the regex.
  - `toHaveText` with an array checks the count, the order and an exact (whitespace-normalized) match for every name, and it retries. That makes the guard and the loop unnecessary.
  - **No pets:** the old `.first()` guard failed for an owner with no pets. `toHaveText([])` passes when no pet cells exist, which is the right result when the list also shows no pets.
- **Verified:** `npx playwright test tests/web-tables.spec.ts` passes 5 of 5 against the live app. A temporary probe test (deleted afterwards) ran the same flow for a two-pet owner (phone 6085558763, `["Jewel", "Rosy"]`) and passed, confirming both pages list pets in the same order.

### Changed: `openOwnerInformationUsingTelephone` reads pet names with `allInnerTexts()` instead of `allTextContents()` + `trim()`

- **File:** `playwright-utils/pages/owners-page.ts`
- **What changed:** `(await ...allTextContents()).map(petName => petName.trim())` became `await ...allInnerTexts()`. The comment above it was updated to say why.
- **Why:**
  - The pet row's HTML is `<tr> George </tr>`. `allTextContents()` returns the raw DOM text (`" George "`), which needed a manual `trim()`. `allInnerTexts()` returns the text as the browser renders it, so the whitespace is already removed.
  - A temporary probe test (deleted afterwards) confirmed it on the live app: one-pet owner `[" George "]` vs `["George"]`, two-pet owner `[" Jewel ", " Rosy "]` vs `["Jewel", "Rosy"]`.
  - Rendered text also matches what the user sees: text hidden with CSS is left out, which suits a UI test. Each pet row holds only the name, so `innerText`'s tab and newline joining between cells doesn't apply.
  - Everything else is unchanged. Neither method waits or requires exactly one match, and both return `[]` when nothing matches, so the `await expect(ownerRow).toBeVisible()` guard is still needed.
- **Verified:** `npx playwright test tests/web-tables.spec.ts` passes 5 of 5 against the live app.

### Fixed: `openOwnerInformationUsingTelephone` now awaits the navigation and always collects the real pet names

- **File:** `playwright-utils/pages/owners-page.ts`
- **What changed:**
  - Added the missing `await` before `this.openOwnerInformation(ownerName!)`.
  - Removed the `let petNames = ['']` default and the `if (await ... .isVisible())` branch. The method now calls `allTextContents()` on the owner's pet rows directly and trims each name: `.map(petName => petName.trim())`.
- **Why:**
  - **Missing `await`:** without it the method returned before the click, the `GET /api/owners/<id>` response check and the URL check had finished. A failure in those checks surfaced as an unhandled rejection instead of failing the step. The test passed only because the next assertion (`expectOwnerTelephone`) retried until the page loaded.
  - **`isVisible()` removed:** `isVisible()` is strict, so an owner with two or more pets would throw a strict-mode violation. It also doesn't retry, so its result depended on timing.
  - **`['']` default removed:** an empty name made `expectPetNames` build `new RegExp('')`, which matches any text, so the pet name check could never fail. `allTextContents()` already returns `[]` when there are no pet rows, so no default is needed. It's safe to call without waiting because `await expect(ownerRow).toBeVisible()` guards it, and the pet rows render together with the owner row.
  - **`trim()`:** the raw row text is `" George "`. After removing the `['']` default, the untrimmed name built the regex `/ George /i`, which didn't match the `dd` text `"George"`. The test failed on the first run, which confirmed the old version had been a false pass.
- **Verified:** `npx playwright test tests/web-tables.spec.ts` passes 5 of 5 against the live app. Before the `trim()` fix the telephone test failed with `Expected pattern: / George /i, Received string: "George"`.

---

## 2026-11-03

### Changed: dialog-boxes spec uses unique names, checks the dialog message in the test, and covers dismissing the dialog

- **Files:** `playwright-utils/pages/pet-types-page.ts`, `tests/dialog-boxes.spec.ts`
- **What changed:**
  - `deletePetType(petType, { accept = true } = {})` now accepts or dismisses the confirmation dialog and **returns** the dialog's message. It no longer asserts the message itself.
    - Accept: waits for the `DELETE /api/pettypes/<id>` response and checks `ok()`, as before.
    - Dismiss: no DELETE request is expected. The method ends by checking that the row's textbox still holds the pet type.
  - New validation method `expectDeleteDialogMessage(dialogMessage, expectedMessage)`.
  - `addNewPetType` now waits for `getByRole('heading', { level: 2, name: 'New Pet Type' })`. It used to use `getByRole('heading', { level: 2 }).last()` with `toHaveText`.
  - `addNewPetType` still fills `#name`. The code now has a comment explaining why.
  - Spec: the tests are wrapped in `test.describe('Pet type delete dialog')`, with a comment on why `restorePetTypes` is requested but unused.
  - Spec: each test uses a unique name, ``pig-${Date.now()}``, instead of `'pig'`.
  - Spec: new test `User keeps a pet type by dismissing the confirmation dialog`.
- **Why:**
  - **Unique names:** `findPetTypeRow` uses `indexOf`, so it picks the first matching row. With a fixed `'pig'`, a "pig" type that already exists would be deleted instead of the one the test added. `restorePetTypes` only renames changed types and deletes added ones, so it could never bring back a deleted original.
  - **Dialog message as a goal assertion:** the message is what this spec is really testing. The POM rules keep goal assertions in `expect*` methods, not in action methods. The dialog is a native browser dialog, not a DOM element, so no locator assertion can reach it. The captured string is asserted directly, after the dialog has been handled.
  - **`{ accept }` option instead of a second method:** accept and dismiss share the row lookup, the listener and the click. The rules say to parametrize instead of keeping two near-identical methods. The DELETE wait is only set up when accepting, because a dismissed dialog sends no request and the wait would otherwise time out.
  - **Dismiss test:** a dialog spec should cover both outcomes. The dismissed type is still removed afterwards by `restorePetTypes`, which deletes any type added during the test.
  - **Heading locator:** matching by `name` removes the positional `.last()` the scripting rules warn against.
  - **`#name` kept:** I tried `getByLabel('Name')` and it timed out. The snapshot shows the "Name" caption is a plain element, not a `<label>`, so the input has no accessible name. The application source isn't in this workspace, so a `data-testid` can't be added. A stable id is the best hook left, and it isn't a styling class.
- **Verified:** `npx playwright test tests/dialog-boxes.spec.ts tests/lists-and-dropdowns.spec.ts tests/input-fields.spec.ts` passes 7 of 7 against the live app. This includes both dialog tests and the other specs that use `PetTypesPage`.

### Changed: merged the "last name not found" search into `searchByLastName` and added a test for it

- **Files:** `playwright-utils/pages/owners-page.ts`, `tests/web-tables.spec.ts`
- **What changed:**
  - `searchByLastName(lastName, expectedStatus = 200)` now asserts `status()` with `toBe(expectedStatus)`. Before, it asserted `ok()`.
  - Removed `expectErrorWhenLastNameDoesNotExist`. It had replaced `searchByLastNameThatDoesNotExist` (the method in the next entry down).
  - The "No owners with LastName starting with "<lastName>"" check now has its own validation method, `expectNoOwnersFoundMessage(lastName)`.
  - New test: `User sees a message when no owner has the searched last name`. It calls `searchByLastName('xyz', 404)`, then `expectNoOwnersFoundMessage('xyz')`.
- **Why:**
  - The removed method was a copy of `searchByLastName` except for the status it expected. The project's POM rules say to parametrize in that case instead of keeping two methods.
  - It was named `expect*` but also filled the search box and clicked Find Owner. The rules keep actions and goal assertions in separate methods, so the test now reads action → validation.
  - `expectedStatus` defaults to 200, so the existing `searchByLastName('black')` call doesn't change. `toBe(200)` is slightly stricter than `ok()`, which accepted any 2xx.
  - The message check uses `getByText(...).toBeVisible()`. The message has no unique parent with a role or `data-testid`, the rules ban CSS class selectors, and the application source isn't in this workspace, so a `data-testid` can't be added.
- **Verified:** `npx playwright test tests/web-tables.spec.ts` passes 4 of 4 against the live app.

### Added a 404 check to `searchByLastNameThatDoesNotExist`

- **File:** `playwright-utils/pages/owners-page.ts`
- **What changed:** after awaiting the `GET /api/owners?lastName=` response, the method now asserts `expect(findOwnerResponse.status(), ...).toBe(404)`. The message includes the URL and the actual status, like the message in `searchByLastName`.
- **Why:**
  - The user asked for the method to confirm that searching for a last name that doesn't exist returns 404. Before, the response was awaited but never checked.
  - `toBe(404)` checks the exact status. `ok()` covers only 2xx, and `not.ok()` would also pass on a 500.
  - The custom message shows the URL and the status that came back, so a failure is easy to read without opening the trace.
- **Verified:** not run. No spec calls this method yet.

### Fixed `expectLastNameInOwnerName` so "Validate search by Last Name" checks only the last name

- **File:** `playwright-utils/pages/owners-page.ts`
- **What changed:** the method no longer reads `textContent()` and splits it. For each owner-name link it asserts `toHaveText(/\s\S*<lastName>\S*\s*$/i)`. The search term is regex-escaped first, and the links are found with `getByRole('cell').getByRole('link')` instead of `locator('tbody tr')`.
- **Why:**
  - The original `toContainEqual` on a string compared each *character* with `"black"`, so it could never pass. The follow-up attempt used `toContainText` on a string, but that matcher only works on locators.
  - The regex reads "after a space, a word containing the term, then the end of the text". So it matches only the last word, as a case-insensitive substring. This was the user's requirement: check the last name, not the whole name.
  - `toHaveText` on a locator is a web-first assertion that retries. The project rules say to avoid generic `expect(string)` assertions.
  - `tbody tr` also matched the rows of the pets table nested inside each owner's Pets cell. Those rows have no link, so the loop timed out on row 1. Only the Name cell holds a link, so `cell → link` returns exactly one link per owner.
  - The term is escaped so a search containing regex characters (e.g. `.`) is matched literally.
- **Verified:** the test passes against the live app. Before the fix it failed with `toContainEqual … Expected "black", Received "black"`. A standalone check of the regex: `Jeff Black`/`black` → true, `BLA` → true, `Jeff Blackwell`/`black` → true, `Jeff Black`/`jeff` → false (first name ignored), `Black Smith`/`black` → false.

### Fixed `Validate owners count of the Madison city` in `tests/web-tables.spec.ts`

**Verified:** `tests/web-tables.spec.ts` passes 2 of 2 against the live app. Before the fix, the Madison test failed with `Expected: 4, Received: 0`.

#### Fixed: `openOwners` finished before the owners list loaded

- **File:** `playwright-utils/pages/header-component.ts`
- **What changed:** `openOwners()` now waits for the `GET /api/owners` response after clicking Search, and checks that the response is OK.
- **Why:** the method only waited for the "Owners" heading, which renders before the data arrives. The failure snapshot still showed the loading progress bar and the empty-table placeholder, so `count()` (which doesn't auto-wait) ran against a table with no rows. Every test that opens the Owners page now starts with the list loaded.

#### Fixed: `returnNumberOfOwnersBasedInCity` only looked at the first row's city

- **File:** `playwright-utils/pages/owners-page.ts`
- **What changed:**
    - The locator `locator('tbody tr').locator('td').nth(2)` is now `locator('tbody tr td:nth-child(3)')`.
    - An `expect(...first()).toBeVisible()` start guard now runs before `count()`.
- **Why the locator change:** chained locators produce one flat list of every `td` in the table, so `.nth(2)` picked only the third cell of the whole table (row 1's City). The count could never be more than 1. `:nth-child(3)` is evaluated for each row, so it matches every row's City cell.
- **Why the start guard:** the project rules require an auto-waiting check before non-auto-waiting calls like `count()`. (Removed by the next change, which no longer calls `count()`.)

#### Replaced: `returnNumberOfOwnersBasedInCity` with `expectOwnerCountInCity`

- **Files:** `playwright-utils/pages/owners-page.ts`, `tests/web-tables.spec.ts`
- **What changed:**
    - `returnNumberOfOwnersBasedInCity(cityName)`, which returned a number, is now `expectOwnerCountInCity(cityName, expectedCount)`, which asserts with `toHaveCount`.
    - The test calls `await pom.ownersPage.expectOwnerCountInCity('Madison', 4)` instead of `expect(...).toEqual(4)`.
    - The `toBeVisible()` start guard is removed, and so is the now-unused `expect` import in the spec.
- **Why:** the project rules put the test's goal assertion in a dedicated `expect*` page-object method and say to avoid generic assertions like `toEqual` on a number, because they don't retry. `toHaveCount` retries until the count matches, so the start guard is no longer needed. The `return` prefix also didn't fit the naming convention.
- **Verified:** `tests/web-tables.spec.ts` passes 2 of 2, and no references to the old name remain.

### Optimized the owner-details test in `tests/web-tables.spec.ts`

**Verified:** `tests/web-tables.spec.ts` and `tests/lists-and-dropdowns.spec.ts` (which also uses `OwnerInformationPage`) pass 4 of 4 against the live app. No references to `expectPetName` remain.

#### Removed: `expectPetName`

- **Files:** `playwright-utils/pages/owner-information-page.ts`, `tests/web-tables.spec.ts`
- **What changed:** the method and its call in the test are gone.
- **Why:** `expectPetInformation(petName, petType)` already finds the pet's cell by name, so it fails if the pet is missing. `expectPetName` added no coverage. It also broke project rules: it called `.all()` and `textContent()` with nothing waiting first, compared with `===` and threw its own error with no retry, and returned `true` from an `expect*` method.

#### Renamed: the test title

- **File:** `tests/web-tables.spec.ts`
- **What changed:** `Validate the pet name city of the owner` is now `Owner details show the owner city and pet type`.
- **Why:** the rules want test names that describe what the user sees, and the old title was hard to read.

#### Tidied: `expectOwnerInformation`

- **File:** `playwright-utils/pages/owner-information-page.ts`
- **What changed:** the `/** ... */` comment is now a `//` comment, and the `if (ownerCity)` body has braces.
- **Why:** it matches the comment style in the rest of the file, and braces make the two-line statement harder to break when it's edited later.

---

## 2026-11-02

### Optimized `tests/dialog-boxes.spec.ts`

**Verified:** `tests/dialog-boxes.spec.ts` and `tests/input-fields.spec.ts` pass 4 of 4 against the live app. Before the changes, the dialog test passed and all 3 `input-fields` tests failed. `npx tsc --noEmit` couldn't run because TypeScript isn't installed in this project.

#### Fixed: `expectPetTypeAtRow` broke `tests/input-fields.spec.ts`

- **File:** `playwright-utils/pages/pet-types-page.ts`
- **What changed:** the signature is back to `(rowId, petType)`, from the uncommitted `(petType, rowId?)`.
- **Why:** the new order swapped the arguments in every `input-fields` call, so the test looked for `[id="dog"]` with an expected value of `"1"`. All 3 tests failed on that. TypeScript couldn't catch it because both arguments are strings.

#### Changed: dialog handling in `deletePetType`

- **File:** `playwright-utils/pages/pet-types-page.ts`
- **What changed:**
    - `page.once('dialog', ...)` replaces `page.on('dialog', ...)`.
    - The handler now only saves the message and accepts the dialog. The message is asserted after the click.
- **Why `page.once`:** a `page.on` listener stays active after it runs. A second delete in the same test would add another listener, and both would try to accept the same dialog, which throws because it's already handled.
- **Why assert after the click:** the old `expect` ran inside the event handler, before `dialog.accept()`. A wrong message threw there, so the dialog was never accepted and the test wouldn't fail cleanly. The dialog blocks the click until it's handled, so the handler has to accept first.

#### Replaced: `expectNotPetTypeAtRow` with `expectPetTypeNotListed`, and added `expectPetTypeAtLastRow`

- **File:** `playwright-utils/pages/pet-types-page.ts`
- **What changed:**
    - `expectPetTypeNotListed(petType)` checks every row, using `expect.poll` over the live values.
    - `expectPetTypeAtLastRow(petType)` checks the textbox in the table's last row.
- **Why `expectPetTypeNotListed`:** the old check only looked at the last textbox on the page, so it would pass even if the pet type was still in another row.
- **Why `expect.poll`:** input values set by Angular can't be matched by a locator, and a single read could run before Angular removes the row. Polling rereads the table until the pet type is gone.
- **Why `expectPetTypeAtLastRow`:** the old `getByRole('textbox').last()` covered the whole page, so the Add form's input could have satisfied it. It now looks only inside the table.

#### Extracted: `findPetTypeRow` and `readPetTypeValues`

- **File:** `playwright-utils/pages/pet-types-page.ts`
- **What changed:** the row lookup copied into `openEditPetType` and `deletePetType` now lives in these two private methods.
- **Why:** `findPetTypeRow` removes the duplicated lookup, and `readPetTypeValues` is shared with `expectPetTypeNotListed`, which needs the same list of values.

#### Renamed: `detelePetType` and the test title

- **Files:** `playwright-utils/pages/pet-types-page.ts`, `tests/dialog-boxes.spec.ts`
- **What changed:**
    - `detelePetType` is now `deletePetType`.
    - The test title "Validate selected specialities" is now "User can add a pet type and delete it by accepting the confirmation dialog".
- **Why:** the method name was a typo, and the title was copied from another spec and didn't describe this test.

#### Extended: `restorePetTypes` deletes added pet types

- **File:** `playwright-utils/fixtures/custom-fixtures.ts`
- **What changed:** after the test, the fixture deletes any pet type that wasn't in its starting snapshot.
- **Why:** it only undid renames, so a failure between the add and delete steps would have left "pig" on the shared server.
- **Verified:** the test deletes its own pig, so it never exercises this code. A temporary spec that left a pet type behind confirmed the fixture removed it, and that spec was then deleted.

### Expanded the project logs

- **Files:** `QA.md`, `CHANGELOG.md`
- **What changed:** today's 3 `QA.md` entries (`readPetTypeValues`, `expect.poll`, why poll) now hold the full explanations from chat, including tables, code blocks and step-by-step flows. Today's `CHANGELOG.md` entries were rewritten in this detailed format.
- **Why:** the user asked for both files to keep the detail from the chat summaries, because it helps when looking back later.

---

## 2026-10-23

- **Fixed** URL regexes in `playwright-utils/pages/owner-information-page.ts` and `playwright-utils/pages/edit-pet-page.ts`: `d+` was missing its backslash, so it matched a literal "d" and both tests in `tests/lists-and-dropdowns.spec.ts` timed out on `toHaveURL`.
- **Fixed** Edit Pet locators in `playwright-utils/pages/edit-pet-page.ts`. The Owner and current-Type textboxes have no accessible name (their labels point at other inputs), so `getByRole('textbox', { name: ... })` could never match. They now use `#owner_name` and `#type1`, because the app is remote and no `data-testid` can be added. The dropdown is now `getByRole('combobox', { name: 'Type' })`.
- **Replaced** `updatePet()` with `updatePetType(petType)` in `edit-pet-page.ts`. It picks the type, clicks Update Pet, and waits for `PUT /api/pets/{id}`. The old method waited for a `GET`. `selectPetType` now ends by checking the dropdown value. **Added** `expectPetTypeOptions(...petTypes)` to check the full option list in one assertion.
- **Fixed** "Validate the pet type update" in `tests/lists-and-dropdowns.spec.ts`: it never saved the change. It now calls `updatePetType('bird')` before checking the owner page.
- **Fixed** `expectPetInformation` in `owner-information-page.ts`. It ran an exact `toHaveText` on the whole pet cell, so it could never pass. It now asserts the `dd` after the "Type" `dt`, inside the pet's cell (`getByRole('cell', { name: 'Name <pet> Birth Date' })`). `expectOwnerInformation` no longer uses the `.ownerFullName` class: it scopes to the row whose row header is "Name".
- **Renamed** `updatePetDetails` → `openEditPet` (`owner-information-page.ts`) and `viewOwnerDetails` → `openOwnerInformation` (`owners-page.ts`), and the PageManager property `ownersInformationPage` → `ownerInformationPage`. Removed the redundant `.first()` visibility check before the owner click, a double `await`, and unneeded template literals.
- **Simplified** "Validate selected pet types from the list": a loop replaces the five repeated select/expect pairs, and it now checks the full option list too.
- **Added** the `restorePetTypeOfPets` fixture to `playwright-utils/fixtures/custom-fixtures.ts`, following the `restoreVetSpecialties` pattern. It saves every pet from `GET /pets` before the test. Afterwards it sends `PUT /pets/{id}` for any pet whose type changed, even if the test failed. Added a `Pet` type. `tests/lists-and-dropdowns.spec.ts` requests it in `beforeEach`. Verified: after the run, Rosy was `dog` again, and a second run also passed.
- **Removed** the trailing `toHaveValue` check from `selectPetType` in `playwright-utils/pages/edit-pet-page.ts`. `selectOption()` already fails if no option matches, and the spec calls `expectPetType` straight after, which asserts the same value plus the `#type1` box. Both tests in `tests/lists-and-dropdowns.spec.ts` still pass.

---

## 2026-10-22

- **Created** `CHANGELOG.md` to record corrections made to the codebase from here on.
- **Created** `QA.md`, a project-specific log of conceptual questions and answers. Seeded it with the 9 earlier petclinic-pw-pom entries moved from the global `~/.claude/claude-qa.md`; they were then removed from that file, so they now live only in `QA.md`.
- **Rewrote** `updateSpecialities` in `playwright-utils/pages/edit-veterinarians-page.ts`. It now targets each requested checkbox directly by name instead of looping over every checkbox and reading its `id`. Also: fixed the dropdown-open check (`'.dropdown show'` was an invalid selector that never matched, so the dropdown was always clicked), removed the unused `shouldBeChecked`/`shouldNotBeChecked` variables, and made both lists default to `[]`.
- **Added** end-of-method checks to `updateSpecialities` in `playwright-utils/pages/edit-veterinarians-page.ts`: after all clicks, each checkbox in `check` must be checked and each in `uncheck` must be unchecked, with a custom message naming the checkbox. Requested by the user, so the final state is confirmed explicitly.
- **Removed** those end-of-method checks from `updateSpecialities` again. The test confirms the final state by calling `expectSelectedSpecialities` afterwards, and `check()`/`uncheck()` already fail if a checkbox doesn't reach its target state.
- **Changed** both methods in `playwright-utils/pages/edit-veterinarians-page.ts` to use rest parameters, so callers pass names without square brackets. `expectSelectedSpecialities(...currentSpecialities)`. `updateSpecialities(action: 'check' | 'uncheck', ...specialityNames)` now handles one direction per call (a function can't have two rest parameters) and uses `setChecked()` instead of separate `check()`/`uncheck()` loops. No callers needed updating yet.
- **Changed** `updateSpecialities` in `playwright-utils/pages/edit-veterinarians-page.ts` to take one object mapping each speciality to its target state (`{ surgery: true, radiology: false }`), so ticking and unticking happen in a single call without square brackets. It loops over `Object.entries()` and calls `setChecked()` for each entry.
- **Changed** `updateSpecialities` in `playwright-utils/pages/edit-veterinarians-page.ts` again, at the user's request, to `updateSpecialities(...newSpecialities)`: the given specialities end up checked and every other checkbox is unchecked. It loops over all checkboxes and reads each one's `id`, the same way `expectSelectedSpecialities` does, so both methods have the same shape and the same call style.
- **Wrote** the test `User can change the selected specialties of a veterinarian` in `tests/checkboxes.spec.ts`. It edits Helen Leary, checks the starting state (`radiology`), switches to `surgery`, then to `surgery` + `dentistry`, and verifies the dropdown text and every checkbox after each step. It never clicks Save, so no data changes and no cleanup is needed.
- **Registered** `VeterinariansPage` and `EditVeterinarianPage` in `playwright-utils/fixtures/page-manager.ts` (as `veterinariansPage` and `editVeterinarianPage`) so tests can reach them through `pom`.
- **Fixed** `openVeterinarians()` in `playwright-utils/pages/header-component.ts`: "Veterinarians" in the nav bar is a button, not a link, so `getByRole('link', ...)` timed out. It now uses `getByRole('button', ...)`.
- **Added** the `restoreVetSpecialties` fixture to `playwright-utils/fixtures/custom-fixtures.ts`, following the `restorePetTypes` pattern. It saves every vet from `GET /vets` before the test. Afterwards it compares each vet's specialty ids and sends `PUT /vets/{id}` with the saved vet for any that changed, even if the test failed. Added a `Vet` type for the API response. `tests/checkboxes.spec.ts` now requests it in `beforeEach`. Checked by changing Helen Leary to `surgery` through the API in a temporary spec: the fixture put her back to `radiology`.
- **Changed** the dropdown text check in `expectSelectedSpecialities` (`playwright-utils/pages/edit-veterinarians-page.ts`) to ignore order. The app lists saved specialities first, in stored order, then newly ticked ones in click order, so "Select all specialities" and "Unselect all specialities" in `tests/checkboxes.spec.ts` failed on order alone. The check now splits the displayed text, sorts both lists, and compares them inside `expect.poll` (which retries like a locator assertion), with a custom failure message. All 3 tests in `checkboxes.spec.ts` now pass.

---
