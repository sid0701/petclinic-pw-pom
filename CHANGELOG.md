# Changelog

Corrections and changes Claude Code makes to this project, grouped by date (newest first).

Each entry lists the files changed, what changed, why, and how it was verified. Entries from 2026-11-02 onwards use this detailed format; older entries are shorter.

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
