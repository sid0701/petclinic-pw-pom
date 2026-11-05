# Questions & Answers

A running log of doubts about the petclinic-pw-pom project asked to Claude Code, and the answers given.

---

## Is `inputValue()` in a loop the right way to find a table row by an input's value?

**Date:** 2026-10-15
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** The pet type name (e.g. "cat") isn't in the HTML/DOM as text, so I used `inputValue()` on each row's textbox to find the row. Isn't that the better approach?

**A:** Yes, reading the live value is correct. Angular binds the input via `ngModel`/`[value]`, which sets the `value` *property*, not the `value` *attribute*. So selectors like `input[value="cat"]`, `getByText('cat')` or `filter({ hasText: 'cat' })` won't find it, and `inputValue()` is the right tool. The earlier point was only about speed: each `inputValue()` is a separate round trip to the browser. One call can read every value instead:

```ts
const rows = this.page.locator('tbody tr')
const values = await rows.getByRole('textbox').evaluateAll(
    inputs => inputs.map(input => (input as HTMLInputElement).value))
const index = values.indexOf(petType)
if (index === -1) throw new Error(`Pet type "${petType}" not found in table`)
const petTypeRow = rows.nth(index)
```

Both versions read whatever is in the table at that moment, so neither waits for rows to load. You still need a wait first, e.g. `await expect(rows.first()).toBeVisible()`. With ~6 rows the loop is fine, and the change is optional.

---

## Is `expect((await response).ok()).toBe(true)` better than `expect(response.ok(), message).toBeTruthy()`?

**Date:** 2026-10-15
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Wasn't `expect((await deleteArticleResponse).ok()).toBe(true)` a better assertion than storing the response and using `expect(response.ok(), message).toBeTruthy()`?

**A:** They check the same thing. `ok()` always returns a boolean, so `toBe(true)` and `toBeTruthy()` pass and fail in exactly the same cases. `toBe(true)` is the more precise matcher and a reasonable style choice. The difference that matters is the custom message. Without it, a failure only says `Expected: true, Received: false`, with no URL or status code. With `expect(response.ok(), \`PUT ${response.url()} returned ${response.status()}\`)`, the failure says something like "PUT …/api/pettypes/3 returned 500". The inline `(await promise)` form is fine when you need nothing else from the response. To get the message you need the response in a variable. Best of both: `expect(response.ok(), message).toBe(true)`.

---

## What does `const originalPetTypes: { id: number, name: string }[] = await originalPetTypesResponse.json()` do?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What does `const originalPetTypes: { id: number, name: string }[] = await originalPetTypesResponse.json()` in `custom-fixtures.ts` do?

**A:** It reads the body of the `GET /pettypes` response, parses it as JSON (e.g. `[{ "id": 1, "name": "cat" }, …]`) and stores the resulting array in `originalPetTypes`. `json()` returns a Promise, so `await` is needed to get the actual data. The annotation `{ id: number, name: string }[]` means "an array of objects, each with a numeric `id` and a string `name`". It only tells TypeScript what shape to expect, so it gives autocomplete and type checks on `.id` / `.name`. It is not checked at runtime: `json()` returns `any`, and TypeScript accepts whatever the server sends. In the fixture this array is the "before" snapshot. After `use()` runs the test, the fixture fetches the current list, matches entries by `id`, and PUTs back any pet type whose `name` was changed. Optional cleanup: define `type PetType = { id: number; name: string }` once and reuse it on lines 20 and 25.

---

## Why does `if (currentPetType && currentPetType.name !== originalPetType.name)` check `currentPetType` on its own?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** In `if (currentPetType && currentPetType.name !== originalPetType.name)`, why is `currentPetType` checked by itself when the comparison is only between the names?

**A:** It's a guard against `undefined`. `currentPetType` comes from `currentPetTypes.find(...)`, and `find()` returns `undefined` when nothing matches, e.g. when the test deleted that pet type. Without the guard, `currentPetType.name` would throw `TypeError: Cannot read properties of undefined (reading 'name')`. The error would crash the teardown and stop the rest of the restore loop. TypeScript also flags it, because `find()` is typed `PetType | undefined`. `&&` short-circuits: if `currentPetType` is `undefined`, the name comparison never runs. A shorter equivalent is `currentPetType?.name !== originalPetType.name`, but it behaves differently. For a deleted type it gives `undefined !== 'cat'`, which is `true`, so the fixture would send a PUT to an id that no longer exists, and that PUT fails. The explicit `&&` makes the intent clear: deleted pet types are skipped, and only renamed ones are restored.

---

## Does `currentPetTypes.find(...)` also store deleted pet types?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Does `const currentPetType = currentPetTypes.find(petType => petType.id === originalPetType.id)` also store the deleted pet types?

**A:** No. `currentPetTypes` is fetched after the test (after `await use()`), so it holds only the pet types that still exist. A deleted type isn't in that list, so `find()` returns `undefined` for it. `find()` also only searches the array; it never adds anything to it. The deleted type survives only in `originalPetTypes`, the snapshot taken before the test. The loop goes over that snapshot, reaches the deleted type, gets `undefined` from `find()`, and the `currentPetType &&` guard skips it. So the fixture restores renamed types but does not recreate deleted ones. Pet types added by the test aren't in the snapshot, so they are left alone too. If deleted types should come back, add an `else if (!currentPetType)` branch that POSTs to `/pettypes`. The new pet type gets a new id, so anything that relied on the old id won't find it.

---

## Should `restorePetTypes` also recreate pet types the test deleted?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Shouldn't the fixture also recreate deleted pet types? The point of taking a snapshot before the test was to undo every change the test made, deletions included, not just renames.

**A:** The goal is right, but recreating a deleted type doesn't fully restore it. (1) The id changes: a POST to `/pettypes` gets a new id from the server, so anything that used the old id (pets, other tests, hardcoded ids) still points at nothing. (2) Linked data is gone: if the server allowed the delete, the pets of that type were either deleted with it or the delete would have been refused. Recreating the type brings back the name, not those pets. A real undo means resetting the database or seeding it fresh, which the API can't do. (3) If the aim is "leave the data as it was", the fixture should also delete pet types the test created, not only recreate deleted ones. Today the only user of `restorePetTypes` is `tests/input-fields-pom.spec.ts`, and it only renames. `tests/dialog-boxes.spec.ts` adds and deletes its own type inline, without the fixture, so a failure partway through leaves a stray type behind. Deleting added types would fix exactly that. Recommendation: either keep the fixture rename-only and say so in its name, or turn it into a fuller reset: PUT renamed types, POST deleted ones (accepting the new id), DELETE types missing from the snapshot. Then use it in any test that changes pet types.

---

## What does `export { expect }` at the end of `custom-fixtures.ts` do?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What does the `export { expect }` statement at the end of `playwright-utils/fixtures/custom-fixtures.ts` do?

**A:** It re-exports Playwright's `expect`, which the file imported on line 1 from `@playwright/test`. Nothing changes about `expect` itself. It just becomes available from this file too, so a spec can write `import { test, expect } from '../playwright-utils/fixtures/custom-fixtures'` and get the extended `test` (with the `pom` and `restorePetTypes` fixtures) and `expect` from one place. Why it matters: (1) One import source. Specs never need `@playwright/test` directly, so they can't accidentally import the plain `test` and lose the custom fixtures. (2) One place to extend later. If you add custom matchers with `expect.extend({...})`, you can export the extended `expect` here and every spec picks it up with no import changes. The file's own use of `expect` (the checks inside `restorePetTypes`) relies on the import on line 1, not on this export. Today `tests/input-fields.spec.ts` imports only `test` and makes its assertions through `pom` methods, so the export isn't used yet. It's there for convenience and consistency, which is the pattern the project's architecture rules recommend.

---

## What does `.test(response.url())` do in the `waitForResponse` predicate in `pet-types-page.ts`?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** In `/\/api\/pettypes\/\d+$/.test(response.url()) && response.request().method() === 'GET'`, what does `test(response.url())` do?

**A:** `.test()` is the standard JavaScript `RegExp.prototype.test` method. It is not Playwright's `test()`. It runs the regex against a string and returns `true` if the string matches and `false` if it doesn't. Here the string is `response.url()`, the full URL of each network response the page receives. The regex `/\/api\/pettypes\/\d+$/` means: the literal `/api/pettypes/` (the slashes are escaped as `\/`), then `\d+` (one or more digits, the pet type id), then `$` (end of the string). So `.../api/pettypes/3` matches, while `.../api/pettypes` (the list endpoint) and `.../api/pettypes/3/something` don't. With the `&& method === 'GET'` check, the predicate is true only for a GET that fetches a single pet type by id. `waitForResponse` calls this predicate on every response and resolves with the first one that returns `true`. That's how the page object waits for the edit form's data to load after clicking Edit. There is no `^` at the start of the regex, so the protocol, host and port can be anything.

---

## What does `newPetType?: string` mean in a TypeScript method signature?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What does `newPetType?: string` mean in `cancelPetTypeNameEdit(currentPetType: string, newPetType?: string)` in `edit-pet-type-page.ts`?

**A:** The `?` makes the parameter optional. Callers may pass a string or leave the argument out, and inside the method the type is `string | undefined`. Without the `?`, TypeScript would refuse to compile a call that leaves it out. That's why the method checks `if (newPetType !== undefined)` before using it: with a value, it types the new name and then cancels ("edit, then cancel, and the change should be discarded"); without one, it cancels straight away ("open edit and cancel without touching anything"). One method covers both flows instead of two near-duplicates, which follows the project's "reuse first / parametrize" POM rule. Rules: optional parameters must come after the required ones, and `newPetType?: string` is close to `newPetType: string | undefined`, except that with the `?` you can leave the argument out completely. A related choice is a default value (`newPetType = 'x'`), which also makes the parameter optional but substitutes a value instead of `undefined`. That doesn't fit here, because "no value" really means "don't type anything". The check uses `!== undefined` rather than `if (newPetType)` so that an empty string `''` still counts as a value and gets typed.

---

## Can a Playwright `expect` show a custom message when the assertion fails?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Does an `expect` block also take a message that is shown if the condition is not true?

**A:** Yes. Pass the message as the second argument to `expect()`, not to the matcher: `await expect(checkbox, 'Radiology checkbox should be checked after clicking it').toBeChecked();`. The message only appears when the assertion fails. It goes at the top of the error in the terminal and the HTML report, and in the report's step list it replaces the default step title (`Expect "toBeChecked"`), so traces read more clearly. The original matcher details (expected vs. received, locator, timeout) are still printed under it. It works the same way with web-first assertions (`toBeVisible`, `toHaveText`, …), generic ones (`expect(count, 'msg').toBe(3)`), `expect.soft(value, 'msg')` and `expect.poll(fn, { message: 'msg' })` (for poll it's an option in the object). A common mistake is `toBeChecked('msg')`: matchers don't take a message, so that either fails to compile or is ignored. When to use it: when the default output wouldn't tell a reader *why* the check matters, for example in a loop over several checkboxes (`expect(box, \`${name} should be unchecked\`)`). For a simple, self-explanatory check, the default message is usually enough.

---

## How do you pass a variable number of arguments to a function in TypeScript?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** How to pass a variable number of arguments in a function?

**A:** Use a rest parameter: `...name: Type[]`. It collects all remaining arguments into a real array: `async selectSpecialties(...specialties: string[]) { for (const s of specialties) { await this.page.getByRole('checkbox', { name: s }).check(); } }`. Callers pass any number of values, including none: `selectSpecialties('radiology')`, `selectSpecialties('radiology', 'surgery', 'dentistry')`, `selectSpecialties()` (an empty array). If you already have an array, spread it at the call site: `selectSpecialties(...names)`. Rules: only one rest parameter per function, it must be the last parameter (`(vetName: string, ...specialties: string[])` is fine, the reverse isn't), and its type must be an array or tuple type. Alternative: take a plain array parameter, `selectSpecialties(specialties: string[])`, and call it with `selectSpecialties(['radiology', 'surgery'])`. Both work. A rest parameter reads more naturally for a short list of literal values. An array parameter is clearer when the data already lives in an array (e.g. test data), or when the function also needs other optional parameters after the list, since nothing can come after a rest parameter. Avoid the old `arguments` object: it isn't a real array, it isn't typed, and it doesn't exist in arrow functions.

---

## Can a function have two variable-length (rest) parameters?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Can I pass two arguments with variable numbers?

**A:** Not as two rest parameters. A function can have only one, and it must be last, so `(...a: string[], ...b: string[])` is a compile error. If there were two, JavaScript couldn't tell where the first list ends and the second begins in a call like `f('x', 'y', 'z')`. Use array parameters instead, one per list: `async updateSpecialties(toCheck: string[], toUncheck: string[]) { ... }`, called as `updateSpecialties(['radiology', 'surgery'], ['dentistry'])`. Each list can have any length, including empty (`[]`). If the call site is hard to read, or you want either list to be optional, use a single options object: `async updateSpecialties({ check = [], uncheck = [] }: { check?: string[]; uncheck?: string[] }) { ... }`, called as `updateSpecialties({ check: ['radiology'], uncheck: ['dentistry'] })` or `updateSpecialties({ uncheck: ['surgery'] })`. The names make it clear which list is which, and the order doesn't matter. You can still combine one array parameter with one rest parameter, as long as the rest parameter is last: `(toUncheck: string[], ...toCheck: string[])`, though two arrays or an options object is usually clearer.

---

## Should `currentSpecialities` be `string` or `string[]` in `verifyCurrentSpeciality`?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** In `edit-veterinarians-page.ts`, is `currentSpecialities?: string` correct, or should it be `currentSpecialities?: string[]`?

**A:** Use `string[]`. A vet can have zero, one or several specialties, and the plural name already says "a list". With `string`, the caller has to know how the UI formats the list (for example `'radiology, surgery'`), so that formatting detail leaks into the spec. With `string[]`, the caller passes plain data (`['radiology', 'surgery']`) and the page object turns it into whatever the UI shows, for example `.join(', ')` when comparing with `toHaveText`. If the UI's separator or format changes, only the page object needs fixing. Also consider dropping the `?` and using a default of `[]` (`currentSpecialities: string[] = []`): "no specialties" is then an empty list, the method doesn't need an `undefined` check, and `[].join(', ')` is `''`, which matches an empty selection. Other issues in the same method: `toHaveValue` on the heading should be `toHaveText` (`toHaveValue` is for inputs), and `toHaveText()` on line 9 needs an expected value.

---

## How do I check that only the vet's current specialties are ticked in the specialties dropdown?

**Date:** 2026-10-22
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** How do I compare the current specialties with all the specialties and check whether the right checkboxes are ticked?

**A:** Loop over every checkbox, get its specialty name, and use `currentSpecialities.includes(name)` to decide whether it should be checked: `const shouldBeChecked = currentSpecialities.includes(specialityName); if (shouldBeChecked) await expect(checkbox, ...).toBeChecked(); else await expect(checkbox, ...).not.toBeChecked();`. Or in one line: `await expect(checkbox).toBeChecked({ checked: shouldBeChecked })`. Pass a custom message such as `` `${specialityName} should be ${shouldBeChecked ? 'checked' : 'unchecked'}` `` so a failure names the checkbox. That one loop covers both halves of the check: every current specialty is ticked, and nothing else is. Problems in the first draft: (1) `currentSpecialities === await speciality.getAttribute('id')` compares an array with a string, which is always false, so the loop never asserted anything (use `.includes()`); (2) it only asserted `not.toBeChecked()` for matching names, which is backwards; (3) `all()` doesn't auto-wait, so first wait until the dropdown's checkboxes are visible (for example `await expect(checkboxes.first()).toBeVisible()`); otherwise `all()` may return an empty list and the loop passes without checking anything. To catch an empty list explicitly, also assert the count is greater than 0. Read each checkbox's name with `getAttribute('id')` (or its label) only after that wait. Following the POM rules, put this goal assertion in an `expect*` method (e.g. `expectSelectedSpecialities`) and keep opening the dropdown in a separate step or method. Prefer role/label locators or a `data-testid` over the `.selected-specialties` CSS class. Also fix `toHaveValue` → `toHaveText` on the heading.

---

## Why is the pet type dropdown found with `getByRole('combobox', { name: 'Type' })` when its `name` attribute is `pettype`?

**Date:** 2026-10-23
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** In `edit-pet-page.ts`, why is the combobox name "Type" when the element's `name` attribute is `pettype`?

**A:** The `name` option in `getByRole` matches the element's **accessible name**, not its HTML `name` attribute. The HTML `name` attribute (`name="pettype"`) is only the key the form sends to the server; screen readers and Playwright's role locators ignore it. The accessible name of a form control comes from its label. The markup is `<label for="type">Type </label> … <select id="type" name="pettype">`: the label's `for="type"` points to the select's `id="type"`, so the select's accessible name is the label text, "Type" (with whitespace trimmed). The page's ARIA snapshot shows the same thing: `combobox "Type"`. Matching is case-insensitive and by substring unless `exact: true`, so `{ name: 'Type' }` works. To target the HTML attribute instead you would need a CSS selector (`locator('select[name="pettype"]')`), which is lower priority than role locators under the project rules. The same rule explains why the Owner and current-Type textboxes have no accessible name: `label for="owner"` points at a hidden input (`id="owner"`), not the visible `#owner_name`, and no label points at `#type1`.

---

## Does `<label for="...">` only work with `<input>` tags, or with other elements too?

**Date:** 2026-10-23
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What is the logic of a label pointing to the id of an input? Does it apply only to input tags or to other tags as well?

**A:** `<label for="x">` links the label to the element with `id="x"`, which then takes the label text as its accessible name. Clicking the label also focuses or activates the control (it ticks a checkbox, for example). It works only for **labelable elements**: `<input>` (except `type="hidden"`), `<select>`, `<textarea>`, `<button>`, `<meter>`, `<output>`, `<progress>`, and form-associated custom elements. On anything else (`div`, `span`, `section`…) `for` is ignored. A label can also link implicitly by wrapping the control: `<label>Email <input></label>`. That is the petclinic Owner field's problem: `label for="owner"` points at `<input id="owner" hidden>`, and a hidden input has no accessibility role, so the visible `#owner_name` stays unnamed. For non-labelable elements, use ARIA instead: `aria-labelledby="id-of-text"` (it can point at any element, and at several) or `aria-label="text"`. Accessible-name priority: `aria-labelledby` → `aria-label` → native labelling (`<label>`, `alt`, `<caption>`, `<legend>`) → the element's own text (only for roles named from content, such as button, link, heading, cell) → `title`/`placeholder`. In Playwright, `getByRole(..., { name })` uses this whole calculation, and `getByLabel()` finds elements by `<label>`, `aria-labelledby` and `aria-label`.

---

## How does `expectPetInformation` find the pet's type on the owner page?

**Date:** 2026-10-23
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Explain how `await expect(this.page.getByRole('cell', { name: `Name ${petName} Birth Date` }).locator('dt:text-is("Type") + dd')).toHaveText(petType)` works.

**A:** It has three parts. (1) `getByRole('cell', { name: 'Name Rosy Birth Date' })`: each pet is a `<td>` containing a `<dl>` (Name/Rosy, Birth Date/…, Type/dog) plus buttons. A `<td>` is named from its content, so its accessible name is "Name Rosy Birth Date 2001-04-17 Type dog Edit Pet Delete Pet Add Visit". Without `exact: true`, `name` is a case-insensitive substring match, so "Name Rosy Birth Date" selects exactly that pet's cell. Including "Name" and "Birth Date" around the pet name stops it matching a pet whose name merely contains "Rosy", or a type or date that happens to equal the name. The outer `<tr>`/`<table>` aren't matched because the role is `cell`, and the visit-list cell's name ("Visit Date Description Actions") doesn't match. (2) `.locator('dt:text-is("Type") + dd')` searches only inside that cell. `dt:text-is("Type")` is Playwright's CSS extension that matches a `<dt>` whose full text is exactly "Type" (unlike `:has-text`, which is a substring match), and `+ dd` is the standard CSS adjacent-sibling combinator: the `<dd>` directly after that `<dt>`, i.e. the value "dog". It uses only HTML tags, not styling classes; `getByRole('definition')` couldn't pick out the Type value without relying on index. (3) `toHaveText(petType)` is an auto-retrying assertion that the `<dd>` text (whitespace normalized) equals the type exactly. It retries until the timeout, which covers the owner page still loading after the Update Pet redirect. If the cell is missing (wrong pet name) or the `<dd>` differs, it fails with the locator and received text.

---

## Do we need the `toHaveValue` check at the end of `selectPetType` when the test calls `expectPetType` right after?

**Date:** 2026-10-23
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** In `edit-pet-page.ts`, `selectPetType` ends with `await expect(combobox).toHaveValue(petType)`. Is that needed when `expectPetType` checks the same thing?

**A:** No, it is redundant. (1) `selectOption()` already waits for the option to exist and throws if no option matches, so a successful call means the value is set; the dropdown's value changes synchronously, with no navigation or network request to wait for. (2) The test always calls `expectPetType(petType)` straight after, which asserts the same combobox value plus the read-only `#type1` box, the only part that actually updates asynchronously. The architecture rule's end-of-method confirmation is meant for actions whose effect lands later (a navigation, a re-rendered element); here it duplicates the goal assertion. It was added mainly so the method wasn't a single line, which is a cosmetic reason. Removing it leaves a one-action method; that is acceptable here because choosing a dropdown value without saving is the whole user task in that test. The alternative is to drop `selectPetType` and inline `selectOption` in the spec, but that breaks the rule that tests only talk to page objects.

---

## Why is `readPetTypeValues` a separate method, and how does it find the row index or id?

**Date:** 2026-11-02
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Why did we create a separate function `readPetTypeValues` since it was not used in multiple places? How does this function find out the index or the id of the row?

**A:** `readPetTypeValues` is actually used in two places, and it doesn't find the row's index or ID; it only reads the values.

**Why it's a separate function**

Both of these need the same list of values, so the function saves repeating the `evaluateAll` code:

- **`findPetTypeRow`:** uses the list to locate a row.
- **`expectPetTypeNotListed`:** rereads the list on each `expect.poll` retry until the pet type is gone.

**What it returns**

It returns the current value of each textbox in the table, in page order:

```ts
['cat', 'dog', 'lizard', 'snake', 'hamster', 'bird']
```

**Where the index and ID come from**

`findPetTypeRow` works out the index from that list:

```ts
const liveValues = await this.readPetTypeValues()   // ['cat', 'dog', 'lizard', ...]
const rowIndex = liveValues.indexOf(petType)        // 'lizard' → 2
return petTypeRows.nth(rowIndex)                    // third row of the table
```

Position 2 in the list is also row 2 in the table because each row has exactly one textbox. If a row ever had two, the positions would no longer match and this could pick the wrong row.

`openEditPetType` then reads the ID from that row's textbox:

```ts
const petTypeRowId = await petTypeRow.getByRole('textbox').getAttribute('id')
```

---

## How does `expect.poll` work?

**Date:** 2026-11-02
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** How exactly does the `expect.poll` method work?

**A:** `expect.poll` makes a normal check retry. It keeps calling a function you give it and rechecks the result until the check passes or the time runs out.

**Example from `expectPetTypeNotListed`**

```ts
await expect.poll(() => this.readPetTypeValues()).not.toContain(petType)
```

If the pet type is `pig`, this is what happens after the delete:

| Step | Values read | `not.toContain('pig')` | Next step |
|---|---|---|---|
| Attempt 1 | `['cat', 'dog', 'pig']` | Fails | Wait 100 ms |
| Attempt 2 | `['cat', 'dog', 'pig']` | Fails | Wait 250 ms |
| Attempt 3 | `['cat', 'dog']` | Passes | Stop; the test continues |

**Why not a plain `expect`?**

```ts
// Reads the values once, so it fails if the row hasn't disappeared yet
expect(await this.readPetTypeValues()).not.toContain(petType)

// Rereads the values on every attempt
await expect.poll(() => this.readPetTypeValues()).not.toContain(petType)
```

The `() =>` is what makes the difference, because it gives Playwright a function it can call again. Without it, there would only be a single value to check.

**Timing and failures**

- **Wait between attempts:** 100, 250, 500, then 1000 ms, repeating 1000 ms after that.
- **Time limit:** 5 seconds by default, because `playwright.config.ts` doesn't set an expect timeout.
- **If time runs out:** the test fails with the last error from the check.
- **If the function itself throws:** the test fails straight away with no retry, because only a failed check is retried.

You can change these settings, but the project rules say to keep the default timeouts unless debugging shows they're too short:

```ts
await expect.poll(() => this.readPetTypeValues(), {
    message: 'Pet type should be removed from the table',
    timeout: 10000,
    intervals: [500, 1000],
}).not.toContain(petType)
```

**Things to watch for**

- **Always use `await`:** without it, the test moves on without waiting for the check, so a failure may not be caught at that step.
- **It stops at the first pass:** `not.toContain` would pass straight away on an empty table. That's safe here because the table has already loaded by the time the delete finishes.

**When to use it:** use a locator assertion like `toHaveValue` whenever one can do the job. `expect.poll` suits cases where no locator can match, like here: Angular sets these input values as properties, so a selector like `input[value="pig"]` wouldn't find them.

---

## Why poll when `readPetTypeValues` already returns every pet type?

**Date:** 2026-11-02
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Why do we need to poll or retry when the `readPetTypeValues` method returns an array of all the pet types?

**A:** We poll because the array is only a snapshot: it contains every pet type, but only as the table looked at the moment it was read. It doesn't update when the page changes afterwards.

**The timing problem**

`deletePetType` finishes as soon as the browser receives the DELETE response, but Angular removes the row in its own code after that:

```text
1. Test clicks Delete and accepts the dialog
2. Server deletes pig and sends its response
3. Playwright sees the response, so deletePetType finishes
4. Test reads the table → ['cat', 'dog', 'pig']   ← pig is still on the page
5. Angular removes the row                        ← too late for that read
```

Steps 4 and 5 can happen in either order. With a single read, the test would sometimes fail even though the delete worked:

```ts
// Fails if the read happens before Angular removes the row
expect(await this.readPetTypeValues()).not.toContain('pig')

// Reads again until pig is gone
await expect.poll(() => this.readPetTypeValues()).not.toContain('pig')
```

How often a single read would fail wasn't measured, and it might pass most of the time. Polling removes that risk, and it costs almost nothing: if the row is already gone, the first attempt passes and there's no wait.

**Reading all rows and polling solve different problems**

- **Reading all rows:** tells you which pet types are on the page, so you don't have to guess which row to check.
- **Polling:** handles the page still updating, so you don't judge the table too early.

**Why `findPetTypeRow` doesn't poll**

It reads the array only once because the table isn't changing at that point. It first waits for the first textbox to have a value, then looks for a row that should already be there.

---

## Why does `locator('tbody tr').locator('td').nth(2)` pick the TD of only the first row and not all rows?

**Date:** 2026-11-03
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Why does it pick up the TD cell of only the first row and not all the rows in the table?

**A:** Chained locators don't keep rows as separate groups. Each step matches against the result of the step before it, and the result is **one flat list of elements in document order**. `.nth()` then picks a single item from that list.

**Step by step**

```ts
this.page.locator('tbody tr')   // [row1, row2, row3, ...]
    .locator('td')              // every td inside ANY of those rows, as one flat list
    .nth(2)                     // item at index 2 of that flat list → one element
    .getByText('Madison')       // searched only inside that one element
```

The Owners table has 5 columns (Name, Address, City, Telephone, Pets). The flat `td` list is numbered straight across the rows:

| Index | Row | Column |
|---|---|---|
| 0 | Row 1 | Name |
| 1 | Row 1 | Address |
| **2** | **Row 1** | **City** ← `.nth(2)` |
| 3 | Row 1 | Telephone |
| 4 | Row 1 | Pets |
| 5 | Row 2 | Name |
| 6 | Row 2 | Address |
| 7 | Row 2 | City |
| … | … | … |

So `.nth(2)` means "the third `td` in the whole table", not "the third `td` in each row". It works like `document.querySelectorAll('tbody tr td')[2]` in plain JavaScript. `.getByText('Madison')` then searches only inside that single cell, so `.count()` can only return 0 or 1.

**Ways to get the city cell of every row**

1. **Use CSS `:nth-child(3)`.** The browser checks it for each cell against its own parent row, so it matches the third cell in every row:
   ```ts
   this.page.locator('tbody tr td:nth-child(3)')   // one city cell per row
   ```
2. **Loop over the rows and apply `.nth()` to each one.** Here `.nth(2)` runs on a single row's cells:
   ```ts
   for (const row of await this.page.locator('tbody tr').all()) {
       const city = row.locator('td').nth(2)        // third cell of THIS row
   }
   ```

**The rule to remember:** `.nth()`, `.first()` and `.last()` pick from everything the chain has matched so far. They don't apply to each parent separately. To get "the Nth cell of every row", use `:nth-child(N)` or loop over the rows.

---

## Is the method name `returnNumberOfOwnersBasedInCity` correct and as per the project standards?

**Date:** 2026-11-03
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Name of the function, return number of owners based in city, correct, and as per the standards.

**A:** The name is valid camelCase and has no abbreviations, so it passes the basic naming rule. But it doesn't follow the project's standards in two ways.

**1. Returning the number breaks the "validation methods" rule**

`.claude/rules/playwright-architecture.md` says the test's goal assertion belongs in a dedicated `expect*` method on the page object. Right now the method returns a number and the test checks it:

```ts
expect(await pom.ownersPage.returnNumberOfOwnersBasedInCity('Madison')).toEqual(4)
```

`playwright-scripting.md` also says to avoid generic assertions like `expect(number).toEqual(...)` because they don't retry. That rule is the reason the method needed the extra `toBeVisible()` guard before `count()`.

**2. The `return` prefix doesn't fit the naming convention**

Method names should be verb phrases describing a user task or check, like `openOwners` or `expectPetName`. `return` describes what the code does, not what the method is for. Even for a method that returns a value, the usual prefix is `get` or `count`, as in `countOwnersInCity`.

**What the standards point to**

| | Current | Per the standards |
|---|---|---|
| Name | `returnNumberOfOwnersBasedInCity` | `expectOwnerCountInCity` |
| Parameters | `(cityName)` | `(cityName, expectedCount)` |
| Assertion | `toEqual` in the test, no retry | `toHaveCount` in the page object, retries |
| Start guard | Needed before `count()` | Not needed, because `toHaveCount` waits |

```ts
// owners-page.ts
async expectOwnerCountInCity(cityName: string, expectedCount: number) {
    await expect(this.page.locator('tbody tr td:nth-child(3)').getByText(cityName, { exact: true }))
        .toHaveCount(expectedCount)
}

// web-tables.spec.ts
await pom.ownersPage.expectOwnerCountInCity('Madison', 4)
```

Keep a value-returning method like `countOwnersInCity` only if a test needs the number for something other than asserting it, such as comparing it with another count later. Nothing uses it that way now.

---

## Why does `expect('black').toContainEqual('black')` fail?

**Date:** 2026-11-03
**Project:** petclinic-pw-pom

**Q:** The "Validate search by Last Name" test fails even though the last name is "black" and I'm expecting "black". Why?

**A:**

The data is correct. The matcher is the problem. This is the error from running the test:

```
Error: expect(received).toContainEqual(expected) // deep equality
Expected value:  "black"
Received string: "black"
  at playwright-utils\pages\owners-page.ts:39
```

**Why it fails**

`toContainEqual` is for collections. It checks whether any **item** in the received value deep-equals the expected value. When you pass it a string, it treats the string as a list of characters:

| Received | Items it checks | Does any item equal `"black"`? |
|---|---|---|
| `"black"` | `"b"`, `"l"`, `"a"`, `"c"`, `"k"` | No, so the assertion fails |

So it is asking "is one of the characters equal to `black`?", which can never be true.

**Fix**

Use a matcher that compares the whole string:

```ts
// exact match on the last word
expect(ownerNameArray[ownerNameArray.length - 1]).toBe(lastName)
```

Or, if you meant to assert against the array of name parts, pass the array itself:

```ts
expect(ownerNameArray).toContainEqual(lastName)   // or .toContain(lastName)
```

**Matcher cheat sheet**

| Matcher | Received string | Received array |
|---|---|---|
| `toBe` / `toEqual` | Whole string equals | Whole array equals |
| `toContain` | Substring check | Item `===` expected |
| `toContainEqual` | Character deep-equals expected (almost never what you want) | Item deep-equals expected |

---

## Is there a matcher for a partial match on the last name instead of `toBe`?

**Date:** 2026-11-03
**Project:** petclinic-pw-pom

**Q:** Instead of `toBe`, is there a method that just checks for a partial match in the last name?

**A:**

Yes. On a string, `toContain` checks for a substring:

```ts
expect(ownerNameArray[ownerNameArray.length - 1]).toContain(lastName)
// 'blackwell' passes for 'black'
```

For case-insensitive or position-based checks, use `toMatch` with a regex:

```ts
expect(lastNameValue).toMatch(new RegExp(lastName, 'i'))   // anywhere, any case
expect(lastNameValue).toMatch(new RegExp(`^${lastName}`, 'i')) // starts with
```

| Matcher | Check | `'blackwell'` vs `'black'` |
|---|---|---|
| `toBe` | Exact | Fails |
| `toContain` | Substring, case-sensitive | Passes |
| `toMatch(/black/i)` | Regex, any case | Passes |
| `toMatch(/^black/i)` | Starts with | Passes |

**Which one fits the search test:** PetClinic's last-name search is a "starts with" search, so `/^black/i` mirrors the app's behaviour most closely. You can also skip the split entirely and use a web-first assertion on the link, which retries:

```ts
await expect(ownerRow.getByRole('link')).toHaveText(new RegExp(`\\s${lastName}`, 'i'))
```

---

## Which matcher checks a substring case-insensitively?

**Date:** 2026-11-03
**Project:** petclinic-pw-pom

**Q:** Which method can I use to find a substring, case-insensitive?

**A:**

`toContain` has no case-insensitive option, so use `toMatch` with the `i` flag:

```ts
expect(lastNameValue).toMatch(new RegExp(lastName, 'i'))
// 'Blackwell' passes for 'black'
```

Or lowercase both sides and keep `toContain`:

```ts
expect(lastNameValue.toLowerCase()).toContain(lastName.toLowerCase())
```

For a locator, the web-first version retries. Pass a string to `toContainText` with `ignoreCase`:

```ts
await expect(ownerRow.getByRole('link')).toContainText(lastName, { ignoreCase: true })
```

| Value type | Matcher | Retries? |
|---|---|---|
| Plain string | `toMatch(new RegExp(x, 'i'))` | No |
| Plain string | `toLowerCase()` + `toContain` | No |
| Locator | `toContainText(x, { ignoreCase: true })` | Yes |

---

## How do I verify only the last name (not the whole name), substring and case-insensitive?

**Date:** 2026-11-03
**Project:** petclinic-pw-pom

**Q:** I want to verify the last name and not the whole name.

**A:**

`toContainText(lastName, { ignoreCase: true })` only works on a **locator**. Called on a split string (`ownerNameArray[...]`), it fails. Keep the assertion on the link locator, so it retries, and use a regex that only looks at the last word:

```ts
async expectLastNameInOwnerName(lastName: string) {
    // Last word of the name (after the final space) must contain lastName, ignoring case
    const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const lastNamePattern = new RegExp(`\\s\\S*${escapedLastName}\\S*\\s*$`, 'i')
    // Only the Name cell holds a link; 'tbody tr' would also match the nested pets table rows
    const ownerNameLinks = this.page.getByRole('cell').getByRole('link')
    await expect(ownerNameLinks.first()).toBeVisible()
    for (const ownerNameLink of await ownerNameLinks.all()) {
        await expect(ownerNameLink).toHaveText(lastNamePattern)
    }
}
```

**Reading the regex** `/\s\S*black\S*\s*$/i`

| Part | Meaning |
|---|---|
| `\s` | A space, i.e. the boundary before the last word |
| `\S*` | Any non-space characters before the term in the same word |
| `black` | The search term (regex-escaped) |
| `\S*` | Any non-space characters after it, same word |
| `\s*$` | Optional trailing whitespace, then end of text |
| `i` | Ignore case |

| Name | Term | Result |
|---|---|---|
| Jeff Black | black | ✅ |
| Jeff Black | BLA | ✅ |
| Jeff Blackwell | black | ✅ |
| Jeff Black | jeff | ❌ (first name ignored) |
| Black Smith | black | ❌ |

**Gotcha found while fixing:** `locator('tbody tr')` also matched the rows of the small pets table nested in each owner's Pets cell. Those rows have no link, so the loop timed out on row 1. Looping over `getByRole('cell').getByRole('link')` gives exactly one owner-name link per owner.

---

## How do the `escapedLastName` and `lastNamePattern` lines work?

**Date:** 2026-11-03
**Project:** petclinic-pw-pom

**Q:** How do these two statements actually work?

```ts
const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const lastNamePattern = new RegExp(`\\s\\S*${escapedLastName}\\S*\\s*$`, 'i')
```

**A:**

### Line 1: escaping the search term

**Purpose:** some characters have special meanings in a regex. For example, `.` means "any character". If someone searched for `o.brien` without escaping, it would also match `oXbrien`. This line puts a backslash in front of each special character so it matches only itself.

| Piece | Meaning |
|---|---|
| `/[ ... ]/` | A character class: matches any **one** character listed inside |
| `.*+?^${}()\|` | The special characters, listed as plain characters |
| `\]` | A literal `]` (escaped, so it doesn't close the class early) |
| `\\` | A literal backslash |
| `g` | Global: replace **every** match, not just the first |
| `'\\$&'` | The replacement. `'\\'` in a JS string is **one** backslash, and `$&` means "the character that was matched" |

| Input | Output |
|---|---|
| `black` | `black` (nothing special, unchanged) |
| `o.brien` | `o\.brien` |
| `a+b` | `a\+b` |

### Line 2: building the pattern

**Why `new RegExp(...)` and not `/.../`:** a regex literal like `/black/` can't contain a variable. `new RegExp` builds the pattern from a string at runtime, so `${escapedLastName}` can be inserted.

**Why double backslashes:** this is a string first and a regex second. In a JS string, `\\` produces one backslash, so `` `\\s` `` becomes the characters `\s`. If you wrote `` `\s` `` with one backslash, JavaScript would drop it and you'd get a plain `s`. The same thing happened when the shell stripped the backslashes earlier.

With `black` as the term, the regex that's built is `/\s\S*black\S*\s*$/i`:

| Part | Meaning |
|---|---|
| `\s` | One whitespace character: the space before the last word |
| `\S*` | Zero or more **non**-space characters (letters before the term, same word) |
| `black` | The escaped search term |
| `\S*` | Zero or more non-space characters after the term, same word |
| `\s*` | Optional trailing whitespace |
| `$` | End of the text |
| `'i'` | Ignore case, so `Black`, `BLACK` and `black` all match |

Because `\S` can't cross a space, everything between `\s` and `$` must be **one word**: the last one.

### How it matches

`toHaveText(regex)` passes if the pattern is found **anywhere** in the link text; it doesn't have to match the whole text. That's why the `\s` at the start and the `$` at the end are needed: together they pin the match to the last word.

**"Jeff Black" with `black`, which matches:**
1. `\s` matches the space after "Jeff".
2. `\S*` first takes all of "Black", then backs off to zero characters so `black` can match (case-insensitive).
3. The second `\S*` matches nothing, `\s*` matches nothing, and `$` is the end of the text. It's a match.

**"Jeff Black" with `jeff`, which doesn't match:** "Jeff" has no space before it, and after "Jeff" comes a space and "Black". `\S*` can't cross that space to reach `$`, so there's no match. This is how the first name is ignored.

**"Jeff Blackwell" with `black`, which matches:** the second `\S*` takes "well". This is the partial match.

---

## Can we wrap the Find Owner response check in try/catch and check the on-screen error message if it fails?

**Date:** 2026-11-03
**Project:** petclinic-pw-pom

**Q:** In `owners-page.ts` `searchByLastName`, can we add a try/catch so that if the response throws an error, we check for the error message on the screen instead?

**A:** Yes, it's possible, but try/catch isn't the best tool here, for three reasons.

### 1. The response itself usually doesn't throw

| Line | When it throws |
|---|---|
| `await findOwnerClickResponse` | Only when **no matching response arrives** before the timeout, or the page closes. A 500 or 404 does **not** throw; the promise resolves normally with that status. |
| `expect(findOwnerResponse.ok(), ...).toBeTruthy()` | When the status isn't 2xx. This is the line that fails on a server error. |

So a try/catch around the `expect` would catch an assertion error. That's legal, but it means the assertion is being used as an `if`.

### 2. Swallowing the error can hide real failures

If the catch block doesn't assert anything, or its check passes by accident, a broken backend makes the test pass. The catch has to assert the error message, or rethrow.

### 3. A cleaner way: branch on the status, or split the tests

Branching directly is more honest than catching:

```typescript
const findOwnerResponse = await findOwnerClickResponse
if (!findOwnerResponse.ok()) {
    // check the error message shown on screen
}
```

The project rules point toward a better design, though:

- **A test should know which outcome it expects.** A test that passes on both success and error isn't testing either one.
- **Goal assertions go in `expect*` methods**, not inside action methods.

The usual pattern is two tests:

| Test | How |
|---|---|
| Happy path | The current code as it is: `searchByLastName` + `expectLastNameInOwnerName` |
| Error path | Force the error with `page.route('**/api/owners?lastName=*', route => route.fulfill({ status: 500 }))`, call the search, then a new `expectErrorMessage(message)` method on `OwnersPage` |

This makes the error path deterministic, because you don't have to wait for the real backend to fail.

**Open point:** the exact error text or element the app shows on a failed search still needs to be checked in the app (source or a live run) before writing `expectErrorMessage`.

---

## How does allTextContents() work, and does it throw if the pet rows don't exist?

**Date:** 2026-11-04
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** How does the `allTextContents()` method actually work? Does it return an error if, in this case, the pet rows don't exist?

```ts
const petNames = (await ownerRow.getByRole('cell').getByRole('row').allTextContents())
    .map(petName => petName.trim())
```

**A:**

`allTextContents()` doesn't throw when nothing matches. It returns an empty array `[]`.

### What it does

1. **It looks for the elements once, right away.** It doesn't wait for matches to appear.
2. **It collects every match.** No strict-mode check, so 0, 1 or 50 matches are all fine.
3. **It returns each element's `textContent` as a `string[]`.** That's the raw DOM text: whitespace is kept and hidden text is included. This is why the pet names came back as `" George "` and need `trim()`.

### Compared with similar methods

| Method | Waits? | Strict (exactly one)? | When nothing matches |
|---|---|---|---|
| `allTextContents()` | No | No | Returns `[]` |
| `allInnerTexts()` | No | No | Returns `[]` (rendered text: CSS-aware, whitespace normalized) |
| `textContent()` | Yes, up to the action timeout | Yes | Times out and throws |
| `isVisible()` | No | Yes, throws on 2+ matches | Returns `false` |
| `count()` | No | No | Returns `0` |
| `expect(locator).toHaveText([...])` | Yes, retries | No | Retries, then fails the assertion |

It can still throw for reasons that have nothing to do with matching. For example, the page closes or navigates while the call is running.

### The real risk is a silent empty array

Because it doesn't wait, calling it before the page has rendered returns `[]` with no error. The code can't tell "there are no pets" apart from "the pets haven't loaded yet". That's why the project rules say to put a waiting step before `all()`, `count()`, `allTextContents()`, `textContent()` and `inputValue()`.

### In this method

1. `await expect(ownerRow).toBeVisible()` waits until the owner's row exists, so the owners list has loaded.
2. The pet names are in a small table nested inside that same row. Angular renders them together with the row, so once the row is visible its pet rows are already there.
3. So `[]` here really means "this owner has no pets", not "not loaded yet".

**Edge case:** the empty array then reaches `expectPetNames`. There, `await expect(petCells.first()).toBeVisible()` fails, because an owner with no pets has no "Edit Pet" cells. So an owner with no pets currently fails the test even though `allTextContents()` itself didn't throw. Hard-coding the expected names and using `toHaveText([...])` (which passes for `[]` when no cells exist) would fix that.

---

## Isn't allInnerTexts() better than allTextContents()?

**Date:** 2026-11-04
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Isn't using `allInnerTexts()` better than using `allTextContents()` for reading the owner's pet names?

**A:**

Yes, for this case. I checked both methods on the live app with a temporary test:

| Owner | `allTextContents()` | `allInnerTexts()` |
|---|---|---|
| Phone 6085552765 (1 pet) | `[" George "]` | `["George"]` |
| An owner with 2 pets | `[" Jewel ", " Rosy "]` | `["Jewel", "Rosy"]` |

The pet row's HTML is `<tr> George </tr>`, so the spaces are really in the page. `allInnerTexts()` returns the text the way the browser shows it, so the spaces are already removed and `.map(petName => petName.trim())` is no longer needed.

### The difference

| | `textContent` (`allTextContents`) | `innerText` (`allInnerTexts`) |
|---|---|---|
| Source | Raw text nodes in the DOM | Text as the browser renders it |
| Whitespace | Kept exactly | Collapsed and trimmed like on screen |
| Text hidden with CSS (`display: none`) | Included | Left out |
| Line breaks between block elements | No | Yes (`\n`; tabs between table cells) |
| Cost | Cheap (no layout) | Needs layout (negligible here) |
| Waits / strict | No / No | No / No (same behaviour otherwise) |

### Why `innerText` suits UI tests better

- It matches what the user sees, which is what a UI test is checking. A hidden element's text won't sneak into the result.
- No manual cleanup of whitespace.

### When `textContent` is the better choice

- You need the exact raw text, or text that is deliberately hidden (e.g. screen-reader-only text).
- The element contains several block elements or cells. `innerText` joins them with `\n` or tabs, which you may then have to split. Each pet row here holds only the name, so this doesn't matter.

### Recommendation

```ts
const petNames = await ownerRow.getByRole('cell').getByRole('row').allInnerTexts()
```

Everything else about the call is the same: it doesn't wait, it returns `[]` when no rows match, so it still needs the `await expect(ownerRow).toBeVisible()` guard before it.

---

## How does toHaveText() work when the locator matches no elements, or several?

**Date:** 2026-11-04
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** How does the `toHaveText` method actually work? What if the locator matches nothing, or matches several elements? How does it work in `expectPetNames`?

```ts
await expect(this.page.getByRole('cell').filter({ has: this.page.getByRole('button', { name: 'Edit Pet' }) })
    .locator('dt:text-is("Name") + dd')).toHaveText(petNames)
```

**A:**

### The core idea: it retries

`toHaveText` is a web-first assertion. Until the expect timeout runs out (Playwright's default is 5 seconds; this project doesn't override it, which is why failures say `Timeout: 5000ms`), it repeats:

1. Find the elements the locator matches **right now** (it searches again on every attempt).
2. Read their text (`textContent` by default, or `innerText` with `{ useInnerText: true }`).
3. Compare the text with the expected value. On a match it passes at once; otherwise it waits briefly and tries again.

If it still doesn't match when time runs out, the test fails and the error shows the expected value, the last text received and a call log.

### It behaves differently for a single value and for an array

| Expected value | 0 elements match | 1 element matches | 2+ elements match |
|---|---|---|---|
| String or regex: `toHaveText('George')` | Keeps retrying, then fails ("element(s) not found") | Compares that element's text | **Strict mode violation**: fails at once, because one value can't be compared against several elements |
| Array: `toHaveText(['Jewel', 'Rosy'])` | Passes only if the array is empty (`[]`); otherwise retries, then fails | Passes if the array has exactly 1 matching value | Passes if the count equals the array length **and** each element matches its value, **in order** |

With an array, the rules are:
1. The number of elements must equal the number of values.
2. Element 1 is compared with value 1, element 2 with value 2, and so on. Order matters.
3. Every element must match. One wrong name fails the whole check.

### How the text is compared

| Expected | Rule | Example |
|---|---|---|
| String | **Full** match after whitespace normalization: spaces at the start and end are trimmed and runs of whitespace become one space, on both sides | `" George "` passes `'George'`; `"Georgette"` fails `'George'` |
| Regex | Tested against the text; it only needs to match somewhere unless you anchor it with `^...$` | `/Geo/` passes `"George"` |
| Case | Case-sensitive by default; `{ ignoreCase: true }` turns that off | `'george'` fails against `"George"` |

`toContainText` is the same, except a string only has to appear somewhere in the text.

The whitespace normalization is why this assertion would pass even on the raw `" George "` text. The list-side names still need clean values because they are used as data, which is what `allInnerTexts()` gives.

### In `expectPetNames`

The locator intentionally matches **every** pet's Name value (the `dd` after the "Name" `dt` in each pet cell), and `petNames` is an array, so the array rules apply:

| Situation | Result |
|---|---|
| Owner has 1 pet: `['George']`, page shows George | Pass |
| Owner has 2 pets: `['Jewel', 'Rosy']`, page shows Jewel, Rosy | Pass (the two-pet probe confirmed this) |
| Page shows only Jewel | Retries, then fails: count 1 ≠ 2 |
| Page shows Rosy, Jewel | Fails: wrong order |
| Page shows "Jewels" | Fails: not a full match |
| Page not rendered yet | Retries until the pets appear |
| Owner has no pets: `[]`, page shows none | Passes at once |

### One caveat: the empty array

`toHaveText([])` passes immediately when there are 0 elements. It has nothing to wait for, so it would also pass if the page simply hadn't rendered the pets yet. That risk is small in this test:

- `openOwnerInformation` awaits the `GET /api/owners/<id>` response and the URL, and
- `expectOwnerTelephone` runs first and retries until the owner details are on screen. The pets render together with those details.

The empty case is also only reached when the Owners list itself showed no pets for that owner, so the two pages still agree.

---

## What is the exact difference between textContent() and innerText()?

**Date:** 2026-11-04
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What is the exact difference between the `textContent()` method and the `innerText()` method?

**A:**

**One-line answer:** `textContent` returns the raw text stored in the HTML. `innerText` returns the text the way the browser displays it on screen, after CSS and layout are applied.

### Verified in a real browser

Each row was run in Chromium with `page.setContent(...)`:

| Case (HTML) | `textContent()` | `innerText()` |
|---|---|---|
| Extra whitespace: `<div>   George⏎        Franklin   </div>` | `"   George\n        Franklin   "` | `"George Franklin"` |
| Hidden child: `Visible <span style="display:none">Hidden</span>` | `"Visible Hidden"` | `"Visible"` |
| Line break: `Line1<br>Line2` | `"Line1Line2"` | `"Line1\nLine2"` |
| CSS `text-transform: uppercase` on `george` | `"george"` | `"GEORGE"` |
| Inline script: `Text<script>var x = 1</script>` | `"Textvar x = 1"` | `"Text"` |
| Block elements: `<p>Para1</p><p>Para2</p>` | `"Para1Para2"` | `"Para1\n\nPara2"` |
| Table cells: `<td>A</td><td>B</td>` | `"AB"` | `"A\tB"` |
| The element itself is `display:none` | `"  I am hidden  "` | `"  I am hidden  "` (same: nothing is rendered, so the browser falls back to `textContent`) |
| SVG `<text>` element | `"svg text"` | **Throws** `Node is not an HTMLElement` |

### Summary of the rules

| | `textContent` | `innerText` |
|---|---|---|
| What it reads | All text nodes in the DOM | Rendered text only |
| Whitespace | Kept exactly as in the HTML | Collapsed and trimmed like on screen |
| CSS-hidden children | Included | Left out |
| `<script>` / `<style>` content | Included | Left out |
| `<br>`, blocks, table cells | Joined with no separator | `\n`, blank lines, `\t` |
| CSS `text-transform` | Ignored | Applied |
| Non-HTML elements (SVG) | Works | Throws |
| Cost | Cheap (no layout) | Forces a layout calculation (negligible in tests) |
| Playwright return type | `string \| null` | `string` |

### What is the same in Playwright

Both are locator methods with the same waiting rules (also verified):

- **They wait for the element to exist**, up to the action timeout. If it never appears they throw `Timeout ... exceeded`. They don't retry the *value*, so they return whatever text is there at that moment.
- **They are strict.** If the locator matches more than one element they throw `strict mode violation`.

Their "all" versions (`allTextContents()` / `allInnerTexts()`) behave differently: no waiting, no strictness, and `[]` when nothing matches.

### Which one to use

- **`innerText`**: when you compare against what the user sees. Clean whitespace, no hidden text. This is why the project uses `allInnerTexts()` for pet names and `innerText()` for the owner name.
- **`textContent`**: when you need the exact raw text, text that is hidden on purpose (e.g. screen-reader-only labels), SVG text, or when CSS such as `text-transform` would change the value you compare.
- **Assertions:** `expect(locator).toHaveText()` uses `textContent` by default (it normalizes whitespace for string values). Pass `{ useInnerText: true }` to compare the rendered text instead.

---

## Should expectOwnerTelephone be merged into expectOwnerInformation with an optional telephone parameter?

**Date:** 2026-11-04
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** In the telephone test we call two methods, `expectOwnerInformation` and `expectOwnerTelephone`. Shouldn't we merge them into just `expectOwnerInformation` and assert the telephone there too, passing it as an optional parameter?

**A:**

Yes, merging them makes sense, and the project's rules support it. Pass the optional values as an **options object**, though, rather than adding a third positional parameter.

### Why merge

- **They do the same thing.** `expectOwnerTelephone` and the City check inside `expectOwnerInformation` both find the row by its header, then check the cell's text. Only the header and the value differ. The architecture rules say: "Never write two methods that differ only in a hardcoded value — parametrize the existing method instead."
- **The pattern already exists:** `ownerCity` is already an optional parameter.
- **Nothing else needs it:** only the telephone test calls `expectOwnerTelephone`, so the method can be removed.
- **The test reads better:** owner details in one step, then the pets.

### Why an options object

Two positional optional parameters are awkward. Checking the phone without the city would need:

```ts
await pom.ownerInformationPage.expectOwnerInformation(ownerName, undefined, telephone)   // unclear
```

With an options object, each value is named:

```ts
async expectOwnerInformation(ownerName: string, { city, telephone }: { city?: string, telephone?: string } = {}) {
    await expect(this.page.getByRole('heading', { level: 2, name: 'Owner Information' })).toBeVisible()
    // Only the values that are passed are checked; the Name is always checked
    const expectedDetails = { Name: ownerName, City: city, Telephone: telephone }
    for (const [rowHeader, expectedValue] of Object.entries(expectedDetails)) {
        if (expectedValue === undefined) continue
        await expect(this.page.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: rowHeader, exact: true }) })
            .getByRole('cell')).toHaveText(expectedValue)
    }
}
```

The callers read clearly:

```ts
await pom.ownerInformationPage.expectOwnerInformation('Jeff Black', { city: 'Monona' })
await pom.ownerInformationPage.expectOwnerInformation(ownerName, { telephone })
```

Other benefits:

| Benefit | Detail |
|---|---|
| One locator instead of three | Name, City and Telephone share the same row-header locator, written once in the loop |
| Easy to extend | Adding Address later means adding one key, not another parameter |
| Small fix | `if (ownerCity)` treats an empty string as "not passed"; `=== undefined` doesn't |

### Trade-offs

| Trade-off | Detail |
|---|---|
| One existing call changes | `('Jeff Black', 'Monona')` becomes `('Jeff Black', { city: 'Monona' })`. `lists-and-dropdowns` passes only the name and stays the same |
| A mistake is easier to miss | An optional check that isn't passed is skipped silently. That's already true of `ownerCity`, and the method's comment says so |
| Failure messages | The error names the row-header locator (Name, City or Telephone) instead of a method called `expectOwnerTelephone`. You can still tell which field failed |

---

## Why is it { city: 'Monona' } in one call but just { telephone } in the other?

**Date:** 2026-11-04
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Why are we passing `city` with the value Monona (`{ city: 'Monona' }`) but just the `telephone` variable (`{ telephone }`) in the other test?

**A:**

Both calls pass the same kind of object. The second one uses a JavaScript shortcut called **property shorthand**.

### The shortcut

When a variable has the same name as the property you're setting, you can write the name once:

```ts
const telephone = '6085552765'

{ telephone }               // shorthand
{ telephone: telephone }    // what it means: property "telephone" = value of variable telephone
```

### Why the two calls look different

| Call | What's passed | Why it's written this way |
|---|---|---|
| `{ city: 'Monona' }` | A literal string | There's no variable, so the shortcut can't apply. You have to name the property (`city:`) and give the value |
| `{ telephone }` | The `telephone` variable from `const telephone = '6085552765'` | The variable and the property have the same name, so the shortcut applies |

Both produce the object type `expectOwnerInformation` expects, `{ city?: string, telephone?: string }`:

```ts
{ city: 'Monona' }              // → { city: 'Monona' }
{ telephone }                   // → { telephone: '6085552765' }
```

### Other ways to write the same thing

```ts
// Long form for the telephone call (identical behaviour)
expectOwnerInformation(ownerName, { telephone: telephone })

// Shorthand for the city call, if it were stored in a variable first
const city = 'Monona'
expectOwnerInformation('Jeff Black', { city })
```

**Watch out:** the shortcut only works when the names match exactly. With `const phone = '6085552765'`, `{ phone }` would create a `phone` property, which the method doesn't read. You'd need `{ telephone: phone }`. TypeScript catches this one: passing an object literal with a property the type doesn't list is an error.

The telephone test uses a variable because the number is used twice (to find the owner and to check it on the page). The city test uses `'Monona'` only once, so a literal is enough.

---

## What exactly does the expect.poll block in expectSpecialities do?

**Date:** 2026-11-04
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What are these lines in `VeterinariansPage.expectSpecialities` doing exactly?

```ts
await expect.poll(async () => (await specialitiesCell.innerText())
    .split('\n').map(specialityName => specialityName.trim()).filter(Boolean).sort(), {
    message: `${vetName} should have specialities: ${specialities.join(', ') || 'none'}`
}).toEqual([...specialities].sort())
```

**A:**

They read the vet's Specialties cell, turn it into a sorted list of names, and keep retrying until that list equals the sorted list you passed in.

### Step by step, for Linda Douglas

| Step | Code | Result |
|---|---|---|
| 1. Read the cell's text as shown on screen | `await specialitiesCell.innerText()` | `"dentistry\nsurgery"` (each name is in its own `<div>`, so each one is on its own line) |
| 2. Split into lines | `.split('\n')` | `["dentistry", "surgery"]` |
| 3. Remove spaces around each name | `.map(name => name.trim())` | `["dentistry", "surgery"]` (the HTML is `<div> dentistry </div>`, so the spaces could otherwise come through) |
| 4. Drop empty strings | `.filter(Boolean)` | An empty cell gives `""` → `[""]` → `[]`. Without this, "no specialties" would never equal `[]` |
| 5. Sort | `.sort()` | `["dentistry", "surgery"]` |
| 6. Compare | `.toEqual([...specialities].sort())` | You passed `'surgery', 'dentistry'`. Sorted, that's `["dentistry", "surgery"]`, so it matches |

### Why `expect.poll`

`innerText()` reads the cell once and doesn't wait for anything. If the table hasn't finished loading from the API yet, a single read could get stale or empty text. `expect.poll` runs the function again and again until the result matches or the default timeout runs out. That gives it the same retrying behaviour as a locator assertion like `toHaveText`. A plain `expect(await ...).toEqual(...)` would check only once.

### Why sort both sides

The app doesn't show specialties in a fixed order. The test expected "surgery dentistry", but the live app showed "dentistry surgery". Sorting both lists means the check only cares about **which** specialties there are, not their order.

### Why `[...specialities].sort()` and not `specialities.sort()`

`.sort()` changes the array it's called on. `[...specialities]` makes a copy first, so the caller's list stays as it was.

### The `message` option

If the check fails, Playwright shows your own text instead of a generic poll error. For example: `Linda Douglas should have specialities: surgery`. When no names are passed, `specialities.join(', ')` is `''`, so `|| 'none'` makes the message read `should have specialities: none`.

### Compared with the old `toContainText`

| Expected | Cell shows | Old `toContainText` | New check |
|---|---|---|---|
| `surgery` | dentistry, surgery | passed (wrong) | fails |
| `surg`, `dentistry` | dentistry, surgery | `'surg'` alone would pass (wrong) | fails |
| `surgery`, `dentistry` | dentistry, surgery | `'surgery dentistry'` fails because of the order (wrong) | passes |
| *(nothing)* | *(empty)* | n/a | passes |

---

## Should we remove the row id from PetTypesPage too, since it also leaks DOM details?

**Date:** 2026-11-04
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Shouldn't we also remove the row id from the pet types page? `openEditPetType` returns it and `expectPetTypeAtRow` checks it, which leaks a DOM detail into the methods the same way the specialties page did.

**A:**

Yes, I'd remove it. `PetTypesPage` has the same problem as `SpecialtiesPage`: `openEditPetType` returns the input's DOM `id` and `expectPetTypeAtRow(rowId, …)` checks it. Only `tests/input-fields.spec.ts` uses that pair.

### Why it's the same problem

- The `id` attribute is the row's position ("0", "1", …), not the pet type's database id. The test carries a DOM detail from one page object to another.
- It depends on the list order staying the same. If the app ever sorted pet types by name, renaming `cat` to `rabbit` would move the row. The test would then fail even though the app is working.
- A user doesn't notice which row something is in. They notice that the new name is there and the old one is gone.

### What each test would check instead

| Test | Now | With names |
|---|---|---|
| Rename and rename back | row `rowId` = `rabbit`, then = `cat` | `rabbit` listed and `cat` not listed, then `cat` listed and `rabbit` not listed |
| Cancel the edit | row `rowId` = `dog` | `dog` listed and `moose` not listed |
| Blank name, then cancel | row `rowId` = `lizard` | `lizard` listed |

The name checks are **stronger**, not weaker:

- **Rename:** "`cat` not listed" catches a bug where the app adds `rabbit` as a new row and leaves `cat` in place. The row check misses that, because it never looks at the other rows.
- **Cancel:** "`moose` not listed" catches the cancelled name being saved somewhere else in the list. The row check would only notice if it overwrote that exact row.

The one thing you lose is proof that the rename happened **in the same row**. That's a layout detail, not something users depend on, and "old name gone + new name present" already shows it was a rename and not an add.

### How

- `PetTypesPage`:
  - Remove the id read from `openEditPetType` so it returns nothing.
  - Replace `expectPetTypeAtRow` with `expectPetTypeListed`. `expectPetTypeNotListed` already exists, so this mirrors `SpecialtiesPage`.
- `input-fields.spec.ts`: drop the `const rowId = …` lines and use the checks in the table.

### Leave `expectPetTypeAtLastRow` as it is

This one is also position-based, but it doesn't use DOM ids, and the position is the point. It shows that **Add** puts the new pet type at the end of the list, which is what the user sees after saving. `dialog-boxes.spec.ts` uses it for that reason.

---

## Should we add a GitHub Actions pipeline that runs the tests on every push?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Should we create a GitHub Actions pipeline so the tests run every time we push code?

**A:** Yes. It's worth doing, and the `pw-debug-actions` skill already assumes a CI run that uploads a `test-results` artifact. A few things about this repo affect how it should be set up.

### What CI will actually catch here

The tests run against the deployed site `https://petclinic.bondaracademy.com`, not an app built from this repo. So a run on push checks **the test code**: broken locators, POM mistakes, flaky waits. It also shows when the live app has changed underneath us. Since the app can change without a push from us, a nightly `schedule` run is worth adding as well.

### Things to handle

| Issue | Why it matters | Fix |
|---|---|---|
| Login credentials | `.env` is gitignored, so `EMAIL` / `PASSWORD` won't exist in CI and `auth-setup.ts` will fail | Add them as repository **secrets** and pass them as `env:` in the workflow. `ACCESS_TOKEN` is created by global setup, so it doesn't need a secret |
| No traces on failure | `retries: 0` + `trace: 'on-first-retry'` means a CI failure leaves no trace to debug | Use `trace: 'retain-on-failure'`, or `retries: process.env.CI ? 1 : 0` |
| Nothing to download | The runner is thrown away after the job | Upload `test-results/` and `playwright-report/` with `actions/upload-artifact`, using `if: always()` |
| Shared live data | The specs rename and delete pet types, specialties, etc. Two runs at the same time (e.g. push + PR) can break each other | Add a `concurrency:` group so only one run happens at a time. `workers: 1` already keeps tests within a run in order |
| Duplicate runs | `push` on every branch plus `pull_request` runs the suite twice for one change | Trigger on `pull_request` to `main` and `push` to `main`, plus `workflow_dispatch` for manual runs |
| No npm script | `package.json` has an empty `scripts` | Add `"test": "playwright test"` so CI and local runs use the same command |

### Workflow outline

```yaml
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
  schedule: [{ cron: '0 2 * * *' }]
  workflow_dispatch:
concurrency: { group: petclinic-e2e, cancel-in-progress: false }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/*, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          EMAIL: ${{ secrets.EMAIL }}
          PASSWORD: ${{ secrets.PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: test-results, path: test-results/, retention-days: 7 }
```

Once it's green, a branch protection rule on `main` that requires this check stops a PR being merged with failing tests.

---

## Should we also dockerize the project?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Along with a GitHub Actions pipeline, should we also dockerize the project?

**A:** Not now. A Dockerfile would add work without solving a problem this repo has. If we want a fixed environment, run the CI job inside Playwright's official image instead.

### What Docker usually solves, and whether it applies here

| Usual reason | Applies here? |
|---|---|
| Packaging the app under test so tests can start it | No. The app is the remote site `petclinic.bondaracademy.com`; there's nothing of ours to containerize |
| "Works on my machine": different OS, Node or browser versions | Mostly no. `package-lock.json` pins `@playwright/test`, which pins the browser builds. `npx playwright install --with-deps` gives CI the same browsers |
| Screenshot tests that differ between Windows and Linux (fonts, anti-aliasing) | No. The suite has no `toHaveScreenshot` / `toMatchSnapshot`. This is the main reason Playwright projects use Docker, and it would become a real reason if we add visual tests |
| Running on CI systems without Playwright support, or on self-hosted runners | No. GitHub's `ubuntu-latest` runner works fine |

### What it would cost

- Docker Desktop on Windows 11 Home needs WSL2, and running tests locally in a container is slower and harder to debug: no headed mode, and UI mode / trace viewer need extra setup.
- Another file to keep in sync. The image tag has to match the `@playwright/test` version every time we upgrade.

### The middle ground

GitHub Actions can run the job inside Microsoft's prebuilt Playwright image, with no Dockerfile in the repo:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.62.0-noble   # match @playwright/test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/*, cache: npm }
      - run: npm ci
      - run: npx playwright test   # browsers are already in the image
        env:
          HOME: /root   # Firefox needs this in the container; harmless for Chromium
          EMAIL: ${{ secrets.EMAIL }}
          PASSWORD: ${{ secrets.PASSWORD }}
```

This skips the browser install step and fixes the OS-level environment. If we later add screenshot tests, the same image can be used locally to create the baseline screenshots, so local and CI images match exactly.

### When to revisit

- We add visual (screenshot) tests.
- Teammates on macOS/Linux start getting different results.
- We start running the petclinic app ourselves (e.g. a local backend + DB for isolated test data). Then `docker compose` for the app becomes very useful.

---

## What's the difference between environment secrets and repository secrets, and which should hold our credentials?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What's the difference between environment secrets and repository secrets in GitHub, and where should I add my `EMAIL` / `PASSWORD`?

**A:** Use **repository secrets**. The workflow already reads `secrets.EMAIL` / `secrets.PASSWORD` without naming an environment, so repository secrets work with no changes.

### The difference

| | Repository secrets | Environment secrets |
|---|---|---|
| Where you add them | Settings → Secrets and variables → Actions → **Repository secrets** | Settings → **Environments** → *(create e.g. `staging`)* → Environment secrets |
| Which jobs can read them | Every job in every workflow in the repo | Only jobs that declare `environment: <name>` |
| Extra protection | None | Optional rules on the environment: only certain branches (e.g. `main`), required reviewers who must approve each run, a wait timer |
| Same name in both | Overridden | Wins for jobs that use that environment |
| Typical use | One set of credentials for the whole repo | Separate credentials per target (staging vs production), or credentials that need approval before use |

Neither kind is passed to workflows triggered by a PR from a **fork**, and both are masked (`***`) in logs.

### Why repository secrets fit this repo

- There's one target (`petclinic.bondaracademy.com`) and one test account, so there's nothing to keep apart per environment.
- Environment secrets would need `environment: <name>` added to the `test` job in `playwright.yml`. Without it, `secrets.EMAIL` silently comes back **empty** and global setup fails at login.
- Branch restrictions or required reviewers would block or delay PR runs, which defeats running the tests on every PR.

### When to switch to environments

- The suite gets run against more than one deployment (e.g. `staging` and `prod`) with different accounts. Then make one environment each and choose with `environment: ${{ inputs.target }}`.
- The credentials become sensitive enough that runs should only happen from `main` or need someone to approve them.

### How to add them

Either use the web UI (Settings → Secrets and variables → Actions → New repository secret, once for `EMAIL` and once for `PASSWORD`), or the CLI, which prompts for the value so it doesn't end up in shell history:

```sh
gh secret set EMAIL
gh secret set PASSWORD
```

Use the same values as the local `.env`, without the surrounding quotes.

---

## Do we need code changes to read credentials from GitHub secrets instead of the `.env` file?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** When we add the secrets and CI uses them instead of the `.env` file, do we need to change any code?

**A:** No. The code reads `process.env.EMAIL` / `process.env.PASSWORD` and doesn't care where they came from.

### How the value reaches the code

| | Locally | In GitHub Actions |
|---|---|---|
| Who sets `EMAIL` / `PASSWORD` | `require('dotenv').config()` in `playwright.config.ts` reads `.env` | The workflow's `env:` block copies `secrets.EMAIL` / `secrets.PASSWORD` into the process environment before `npm test` starts |
| What `dotenv` does | Loads the two values | Finds no `.env` (it's gitignored), returns an `ENOENT` error object **without throwing**, and leaves the existing variables alone |
| Who reads them | `.auth/auth-setup.ts` → `process.env.EMAIL!` / `process.env.PASSWORD!` | Same |

Checked with dotenv 17 and no `.env` present: `config()` returned `error: ENOENT`, and an `EMAIL` set beforehand was unchanged. dotenv never overwrites a variable that's already set (unless `override: true`), so even if a `.env` existed, the CI values would win.

`ACCESS_TOKEN` isn't a secret in either case. Global setup reads it from the `/token` response and puts it in `process.env`, and the worker processes inherit it.

### Things to watch

- **Quotes:** `.env` has `EMAIL='test@test.com'`. dotenv removes the quotes, but GitHub stores a secret exactly as typed, so leave them out.
- **Missing secret = unclear failure:** an undefined secret becomes an empty string, the `!` in `process.env.EMAIL!` only satisfies TypeScript, login fails, and global setup then waits for `**/token` until it times out. The log shows a timeout, not "EMAIL is missing". Optionally, check for both variables at the top of `auth-setup.ts` and throw a clear error.
- **Log line:** dotenv 17 prints `injected env (0) from .env` in CI. It's harmless; `config({ quiet: true })` hides it.

---

## What does `concurrency` do in `playwright.yml`?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What exactly does the `concurrency` block in `.github/workflows/playwright.yml` do?

**A:** It stops two runs of the pipeline from testing against the live site at the same time.

```yaml
concurrency:
  group: petclinic-e2e
  cancel-in-progress: false
```

### How it works

- **`group`** is just a name. GitHub lets **one run per group name be in progress** at a time, across the whole repo. Our name is a fixed string, so every run of this workflow shares one group: any branch, any trigger (push, PR, manual).
- **`cancel-in-progress: false`**: a new run doesn't stop the one in progress. It waits as **pending** and starts when that run finishes.
- It's at the top level, so it applies to the whole run, not one job.

### What happens when runs overlap

| Event | Result |
|---|---|
| Run A is in progress, run B is triggered | B waits as *pending* |
| A finishes | B starts |
| A is in progress, B is pending, then C is triggered | **B is cancelled**, C takes its place. A group holds at most one running and one pending run |
| Same, with `cancel-in-progress: true` | A is **cancelled in the middle**, and B starts straight away |

So the run that's already going is never interrupted. The cost: if several pushes arrive while a run is going, only the newest one waits, and the ones in between show as *cancelled* (re-run them from the Actions tab if needed). Those runs never started, so nothing was left half done.

### Why we set it up this way

- **Shared data:** the specs rename and delete pet types, specialties and vets on the shared live site. Two runs at the same time could break each other, e.g. one deletes `oncology` while another is checking it.
- **Cleanup:** `cancel-in-progress: true` could stop a run partway through, before its fixtures restore the data, leaving changes on the server. That's why it's `false`.
- **Not per-branch:** the common pattern `group: ${{ github.workflow }}-${{ github.ref }}` only stops overlaps **on the same branch**. A run on `main` and a PR run would still overlap, and they share the same data, so we use one fixed name.

### What it doesn't do

- It doesn't control anything **inside** a run. Tests running one after another comes from `workers: 1` / `fullyParallel: false` in `playwright.config.ts`.
- It only sees GitHub Actions runs in this repo. A local `npx playwright test`, or someone else using the same demo site, can still overlap with a CI run.

---

## What does each part of `playwright.yml` do, and why is it there?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Explain the attributes used in `.github/workflows/playwright.yml` and why each one was chosen.

**A:** The file has three parts: **when** to run (`on`), **how many at once** (`concurrency`), and **what to do** (`jobs`).

### 1. `name`

```yaml
name: Playwright Tests
```

The label shown in the GitHub **Actions** tab and on PR checks. `gh run list --workflow=playwright.yml` finds it by file name either way.

### 2. `on`: what starts a run

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
```

| Trigger | Fires when | Why |
|---|---|---|
| `push` → `main` | A commit lands on `main`, normally when a PR is merged | Confirms `main` itself is still green after the merge |
| `pull_request` → `main` | A PR **targeting** `main` is opened or gets new commits | The main check: catches broken tests **before** merge. GitHub tests the PR merged with the latest `main`, not just the branch on its own |
| `workflow_dispatch` | Someone clicks **Run workflow** in the Actions tab (or runs `gh workflow run`) | Lets you re-check the live app any time without pushing. The button only appears once the file is on `main` |

Pushes to feature branches like `CICD` don't trigger anything by themselves. Otherwise each push to a branch with an open PR would run the suite twice. We left out `schedule` because nightly runs aren't wanted for now.

### 3. `concurrency`

```yaml
concurrency:
  group: petclinic-e2e
  cancel-in-progress: false
```

Only one run at a time across the repo, and a running run is never cancelled, because the specs change data on the shared live site. Full explanation in the earlier entry "What does `concurrency` do in `playwright.yml`?".

### 4. `jobs`: the work

```yaml
jobs:
  test:
```

A workflow can have several jobs. Each runs on its own fresh machine, and they run in parallel unless linked with `needs:`. We have one job, with the id `test`. That id is the check name shown on the PR, and it's what you'd select when making the check required on `main`.

| Key | Value | What it does / why |
|---|---|---|
| `runs-on` | `ubuntu-latest` | A clean Linux VM hosted by GitHub, created for this run and then thrown away. Linux is needed because `container:` uses Docker, and it's also the fastest and cheapest runner |
| `timeout-minutes` | `30` | Stops the job after 30 minutes. The default is **360**. The suite takes a few minutes, so a hang (e.g. waiting forever for `**/token`) would otherwise use up to 6 hours of Actions minutes |
| `container.image` | `mcr.microsoft.com/playwright:v1.64.1-noble` | Every step runs inside Microsoft's Playwright Docker image (Ubuntu 24.04 "noble"), which already has Node, Chromium/Firefox/WebKit and their system libraries. That's why there's no `setup-node` or `npx playwright install --with-deps` step. The tag **must match** `@playwright/test` in `package-lock.json`; otherwise Playwright looks for a browser build the image doesn't have and fails with "Executable doesn't exist" |

### 5. `steps`: run in order; if one fails, the rest are skipped unless they say otherwise

Each step either **uses** a ready-made action (`uses:`) or **runs** a shell command (`run:`). `name:` is just the label in the log.

| Step | What / why |
|---|---|
| `uses: actions/checkout@v4` | The machine starts empty. This clones the repo at the commit being tested. `@v4` pins the major version so a future v5 can't change behaviour without us knowing |
| `run: npm ci` | A **clean install** that uses `package-lock.json` exactly. Unlike `npm install`, it never updates the lockfile and fails if `package.json` and the lockfile don't match, so CI uses the same `@playwright/test`, `dotenv` and `faker` versions we use locally |
| `run: npm test` | Runs the `test` script → `playwright test`. Using the script means CI and local runs use the same command. GitHub Actions sets `CI=true` in every job (container jobs too), which turns on the CI branches in `playwright.config.ts` (`retain-on-failure` trace, `list` + `html` reporter) |
| `env: EMAIL / PASSWORD` | Copies the repository secrets into the process environment **for this step only**, where `auth-setup.ts` reads `process.env.EMAIL` / `PASSWORD`. Kept on the step rather than the whole job so `npm ci` and the uploads never see them. GitHub masks the values as `***` in logs |
| `Upload test results` | `actions/upload-artifact@v4` zips `test-results/` and attaches it to the run as an artifact called **`test-results`**. That folder holds the `trace.zip` of each failed test, and `pw-debug-actions` downloads this artifact by that name |
| `Upload HTML report` | Same for `playwright-report/`, as an artifact called `playwright-report`. Download, unzip, then `npx playwright show-report <folder>` |

Settings on the upload steps:

| Key | Why |
|---|---|
| `if: ${{ !cancelled() }}` | By default a step only runs if every step before it passed. When tests fail, `npm test` fails, so without this the uploads would be skipped exactly when we need the traces. `!cancelled()` means "run whether tests passed or failed, but not if someone cancelled the run". `always()` would upload even after a cancel, which isn't useful |
| `name` | The artifact's name, used by `gh run download <id> --name test-results` |
| `path` | The folder to upload |
| `retention-days: 7` | Artifacts are deleted after 7 days instead of the default 90. Traces are only useful for a few days, and this keeps storage use down |

### `${{ ... }}`

GitHub fills these in **before** the step runs: `secrets.EMAIL` reads a secret, and `!cancelled()` is a status check. They aren't shell syntax, which is why they work the same in `env:`, `if:` and elsewhere.

### What a run looks like

1. A PR to `main` is opened → GitHub queues a run (or waits behind one already running, because of `concurrency`).
2. An Ubuntu VM starts → pulls the Playwright image → checks out the code.
3. `npm ci` → `npm test` (global setup logs in with the secrets → 19 tests run one at a time).
4. Both artifacts are uploaded, whether the tests passed or failed.
5. The `test` check on the PR turns green or red.

---

## On a real production project, do we run E2E tests on every PR like this, or as nightly builds?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What's the right approach on a project that's in production? Do we use the same approach (tests on push/PR), or nightly builds?

**A:** Both, in **layers**. Each layer runs a different amount of the suite against a different environment. The question isn't "PR or nightly" but "which tests run where, and how fast does each layer need to be".

### The usual layers

| When | What runs | Against | Time budget | Purpose |
|---|---|---|---|---|
| **Every PR** (required check) | Lint, type check, unit/API tests, and a **smoke** set of E2E tests (`@smoke`: login, critical journeys) | A fresh environment built from the PR's code: a **preview / ephemeral environment** or `docker compose` with a seeded DB | ~5–15 min | Block broken code before merge. Must be fast or people stop waiting for it |
| **Merge to `main`** | Deploy to **staging**, then the full or most of the **regression** E2E suite | Staging | ~15–45 min, sharded across machines | Catch what smoke missed, before release |
| **Nightly** (`schedule`) | The **full** regression across **all browsers / devices**, slow tests, visual tests, sometimes accessibility/performance | Staging (sometimes a nightly build) | Hours are fine | Things too slow or wide for every PR. Spots **flaky** tests, and changes in things outside your control (third-party APIs, data, certificates) |
| **After each production deploy** | A tiny, **read-only** smoke set: the site loads, login works, key pages render | **Production** | 1–3 min | Confirms the release works. Can trigger a rollback |
| **Continuously** (every 5–15 min) | Synthetic monitoring: the same read-only checks | Production | Seconds | Finds outages between deploys |

Rule: **never run tests that create, change or delete data against production.** Production checks only read, or use a dedicated test tenant/account that's cleaned up separately.

### What makes this work in a real project

- **Tests run against code they can build.** The app and tests usually live in the same repo (or the pipeline pulls the app image). Each PR gets its **own** environment with seeded data, so runs can't break each other, which removes the need for one `concurrency` lock for everything.
- **Tags pick the subset:** `test('...', { tag: '@smoke' }, ...)` + `npx playwright test --grep @smoke` on PRs, everything at night.
- **Sharding** keeps big suites fast: `--shard=1/4` … `4/4` across a matrix of jobs, then `merge-reports`.
- **Retries in CI** (`retries: 1–2`) with the flaky-test report watched. A test that passes on retry counts as flaky and gets fixed, not ignored.
- **Required checks + branch protection** on `main`, so a red PR can't be merged.
- **Nightly results go somewhere visible:** a Slack/Teams message or an issue on failure. A nightly run nobody looks at isn't worth having.

### How this repo compares

This assignment tests a **shared, already-deployed site** we don't build. That's effectively the "production" column, but with tests that change data. That's why we needed a single `concurrency` group, cleanup fixtures and `workers: 1`. For this setup, **running on PR + push to `main` is the right choice**. A nightly run would only add value here for spotting changes to the live site that happen without a push from us, so it was fine to leave it out for now.

If this were a real product, the next steps would be: add `@smoke` tags, run only those on PRs, and move the full suite to post-merge and nightly runs against an environment we control.

---

## With multiple developers, do we raise a PR for every commit, or one PR for everyone's changes together?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** In a normal production project with several developers making changes, do we raise a pull request for every commit, or one pull request for the combined changes of several developers?

**A:** Neither. The norm is **one PR per unit of work**: one feature, bug fix or ticket, usually by one developer, on its own short-lived branch. A PR normally holds **many commits**, and each developer has their **own** PRs.

### Commit vs branch vs PR

| | What it is | How often |
|---|---|---|
| **Commit** | A checkpoint while working ("add page object", "fix locator", "address review comment") | Many times a day |
| **Branch** | Where one piece of work lives, e.g. `feature/vet-search`, `fix/login-timeout` | One per task |
| **Pull request** | A request to merge **that branch** into `main`: the unit that gets **reviewed, tested by CI and merged** | One per branch / task |

Each new push to a branch with an open PR **updates the same PR**, and CI runs again on it. That's why our workflow triggers on `pull_request`. You don't open a new PR per commit.

### Why not a PR per commit?

- Single commits are often half-finished (they don't build, or tests don't pass yet).
- Reviewers would see the feature in small pieces without context, and CI would run for every one.

### Why not one PR combining several developers' work?

- **Too big to review well.** Reviews of huge PRs turn into a quick skim. Small PRs (roughly under 300–400 changed lines) get faster, better reviews.
- **Unclear ownership.** Who answers review comments, and who fixes a failing check?
- **Everything is blocked together.** One unfinished part holds back all the finished parts, and reverting one change means reverting everyone's.

### Common team setups

- **GitHub flow / trunk-based (most common now):** everyone branches from `main` → small PR → review + green CI → merge, often several times a day per team. `main` is always releasable. This repo already works this way (`webtables`, `dialogboxes`, `CICD` → one PR each).
- **Gitflow:** feature PRs merge into a `develop` branch. Then a **release PR** (`release/2.4` → `main`) brings in many developers' **already-reviewed** work at once. This is the one place a "combined" PR is normal, and it's a release step, not a code review.
- **Several developers on one big feature:**
  - Either they push to a shared `feature/x` branch,
  - or each opens a small PR **into** `feature/x`, and `feature/x` → `main` is merged at the end.
  - Or the work is split behind a **feature flag**, so each part can merge to `main` safely before the whole feature is switched on. Teams on trunk-based development often prefer this, because long-lived feature branches cause painful merge conflicts.

### Related practices

- **Draft PRs:** open the PR early as a draft to get CI feedback and early comments. Mark it "Ready for review" when done.
- **Squash merge:** many teams squash a PR's commits into one commit on `main`, so `main` history reads one entry per feature while the branch keeps the detailed commits.
- **Branch protection on `main`:** no direct pushes, at least one approval, required CI checks passing, branch up to date with `main`. This is what makes "one PR per task" enforced rather than optional. The local `block-master.sh` hook does the same for this repo on your machine.

---

## Are the staging environment and the QA environment the same thing?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Is a staging environment the same as a QA environment?

**A:** Not strictly, though many smaller teams have just one environment and use the two names interchangeably. When a company has both, they do different jobs. **QA** is where new work gets tested while it's still changing. **Staging** is a copy of production where the **release candidate** gets a final check before it goes live.

### Where they sit

```
local → dev / integration → QA (test) → staging (pre-prod) → production
         changes often ────────────────────────────→ changes rarely, controlled
```

### The differences

| | QA / test environment | Staging / pre-production |
|---|---|---|
| **Purpose** | Test new features and bug fixes as they're built | Final check of the exact build that will be released |
| **What's deployed** | Every merge, sometimes individual feature branches; several times a day | Only release candidates; deploys are planned and controlled |
| **Stability** | Often unstable; things break, that's expected | Should be stable; a failure here blocks the release |
| **Matches production?** | Loosely: smaller servers, some third-party services mocked or using sandboxes, different config | As closely as possible: same infrastructure, versions, config, integrations, security setup |
| **Data** | Seeded / made-up test data, reset often | Production-like data (often a copy with personal data removed) and realistic amounts of it |
| **Who uses it** | QA engineers, developers, automated functional/regression suites | QA for final regression, performance/load testing, ops practising the deployment (DB migrations, rollback), sometimes business users for **UAT** (user acceptance testing) |
| **Typical tests** | Feature testing, exploratory testing, full E2E regression | Smoke + regression of the release, performance, security scans, UAT |

Some companies add a separate **UAT** environment between QA and staging for business sign-off. Others combine QA and staging into one. The names matter less than **what each environment is for**: on a new project, ask which one is "production-like" and which one is for daily testing.

### How it fits the earlier CI layers

In the "production project" answer, "merge to `main` → deploy to staging → full regression" assumed a team with **one** pre-prod environment. With both:

- **Merge to `main`** → auto-deploy to **QA** → full E2E regression.
- **Release candidate** → deploy to **staging** → smoke + regression of that exact build, performance checks, UAT → approve → **production**.
- The nightly full run usually targets QA. Some teams run it on staging too.

---

## Are staging and the UAT environment the same thing?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Is the staging environment the same as the user acceptance testing (UAT) environment?

**A:** Often they're the **same machine used for two purposes**, but they answer different questions:

- **UAT:** "Does this do what the business / client actually needs?" Business users check it and **sign it off**.
- **Staging:** "Will this exact build deploy and run correctly in a production setup?" Engineering / ops check it **technically**.

Smaller teams do UAT on staging. Larger or regulated organisations (banking, insurance, healthcare, government), and agencies building software for a client, usually keep a **separate UAT environment**.

### The differences

| | UAT environment | Staging environment |
|---|---|---|
| **Question it answers** | Does it meet the requirements / work for real business tasks? | Does the release deploy and behave like production? |
| **Who uses it** | Business users, product owners, the client, sometimes real end users | QA, DevOps/SRE, developers |
| **Kind of testing** | Mostly **manual**, scenario-based: "process a claim from start to finish", "run month-end billing" | Mostly **automated / technical**: smoke + regression, performance/load, security scans, practising migrations and rollback |
| **Outcome** | A formal **sign-off / acceptance** (sometimes required by contract or regulation) | Technical go/no-go for the deployment |
| **How long a build stays** | Days to weeks: the build is **frozen** so users aren't testing something that keeps changing | Short: deploy, check, promote or roll back |
| **Data** | Realistic business scenarios, sometimes client-specific accounts | Production-like copy and amounts of data |
| **How closely it matches production** | Good enough to behave correctly for users | As close to identical as possible |

### Common orders

```
Separate:   QA → UAT → staging → production    (business accepts, then a final technical check)
            QA → staging → UAT → production    (also used; the order depends on the company)
Combined:   QA → staging (UAT happens here) → production
```

### What it means for automation

- Automated E2E suites mostly run in **QA**, plus smoke/regression in **staging**.
- In **UAT** you usually run a smoke check after each deploy, so business users aren't handed a broken build, and then leave the environment alone. Tests that change data would mess up the scenarios the business users have set up.

As with QA vs staging, the names vary between companies. On a new project, ask who uses each environment and what sign-off happens there.

---

## What's the difference between an E2E suite and a regression suite?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What's the difference between an end-to-end (E2E) suite and a regression suite?

**A:** They describe **different things**, so they aren't opposites:

- **E2E** describes the **level** of a test: how much of the system it covers. An E2E test drives the real app as a user would (browser → frontend → backend → database) through a complete flow.
- **Regression** describes the **purpose** of a run: re-running tests that already passed, to prove that **existing** features still work after a change.

So one test can be both. A regression suite can include tests at any level, and an E2E test isn't regression until it's re-run to protect existing features.

### Side by side

| | E2E suite | Regression suite |
|---|---|---|
| **Describes** | *How* a test runs: the whole system, as a user | *Why* it's run: catch things that used to work and now don't |
| **Contains** | Only E2E tests (UI- or API-driven full journeys) | Any mix: unit, API, integration, **and** E2E tests |
| **Opposite of** | Unit / component / integration tests (smaller scope) | Tests for **new** functionality (feature / acceptance testing) |
| **When it runs** | Wherever you choose: PR, post-merge, nightly | After any change: every PR, before each release, nightly |
| **Example** | "Log in → add a vet → assign a specialty → see it in the list" | Every existing test (unit + API + E2E) re-run after a payment-service refactor |

### How they overlap

```
Regression suite = every test that protects existing features
├── unit tests
├── API / integration tests
└── E2E tests for shipped features   ← what QA teams usually mean by "the regression suite"

Not regression yet:
└── E2E tests for the feature being built now (they join regression once it ships)
```

In practice QA teams often say "regression suite" when they mean "**the automated E2E tests we re-run before every release**", which is why the two get mixed up. Developers' unit tests are part of regression too, even if nobody calls them that.

### Related terms

| Term | What it is |
|---|---|
| **Smoke suite** | A **small**, fast part of regression: "is the build usable at all?" (login, home page, one key flow). Run on every deploy |
| **Sanity check** | A quick, narrow check of the **one area just changed / fixed**, before deeper testing |
| **Full regression** | Everything, often across all browsers, typically before a release or nightly |
| **Partial regression** | Only tests related to the changed area, chosen by tags or by which files changed |

### This repo

The 19 Playwright tests are **E2E tests**: they drive a real browser against the deployed app, through to its backend. Running them on every PR in CI makes them this project's **regression suite** too. If the suite grew, you'd tag a few as `@smoke` for fast PR checks and run the full set as regression after merge or nightly.

---

## Who writes API and integration tests: developers or testers?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** Who writes the API or integration tests: the developers or the testers?

**A:** Usually **both**, at different levels. It depends on how close the test is to the code. The closer it is, the more likely a **developer** writes it in the same PR as the code. The more it treats the system as a **black box** from outside (the way users and other systems see it), the more likely **QA / SDETs** (Software Development Engineers in Test) own it. Modern teams treat quality as the **whole team's** job ("shift-left"), so the line is blurry.

### Typical ownership by test type

| Test type | What it checks | Usually written by | Where it runs |
|---|---|---|---|
| **Unit** | One function / class, with dependencies faked | **Developers** | Every commit / PR, seconds |
| **Integration (code-level)** | Your code + a **real** dependency: DB, message queue, cache (often spun up with Testcontainers / docker) | **Developers** | Every PR |
| **Contract** (e.g. Pact) | Service A and service B agree on the request/response shape | **Developers** of both services | Every PR |
| **API functional** | The deployed API from outside: status codes, validation, auth, error handling, edge/negative cases, data combinations | **QA / SDET** mostly, devs often add the basic "happy path" ones | QA env, post-merge / nightly |
| **API end-to-end / cross-service** | A business flow across several services via their APIs (create order → payment → stock → notification) | **QA / SDET** | QA / staging |
| **UI E2E** | Full user journey through the browser | **QA / SDET** mostly | QA / staging |

The difference between the two "integration" meanings:

- **Developer integration test:** runs inside the code repo, starts the service + a real DB locally, and calls its classes or endpoints. It needs knowledge of the internals, and it fails before the code is ever deployed.
- **QA API test:** a black-box test that sends HTTP requests to a **deployed** environment. It only needs the API spec (Swagger/OpenAPI), and it catches config, deployment and cross-service problems.

### How different organisations do it

| Model | Who writes what |
|---|---|
| **Separate QA team** (traditional) | Devs: unit tests. QA: API + UI test suites, often in a separate repo |
| **QA/SDET embedded in each scrum team** (most common now) | Devs: unit + integration + contract. SDET: API functional + E2E, reviews devs' tests, builds the framework. Both count tests as part of the story's "definition of done" |
| **No dedicated testers** (some big tech) | Developers write every level; a small group may own tools/frameworks |
| **QA as coach / quality engineer** | Devs write most tests. QA designs the test strategy, finds gaps, does exploratory testing and owns the E2E framework |

### For a Playwright tester

API tests are a natural next step for a QA automation engineer, and Playwright supports them directly through the `request` fixture (`request.get / post / put / delete`). This project already sends `Authorization: Bearer <ACCESS_TOKEN>` via `extraHTTPHeaders`, so API tests against the petclinic backend could go in the same framework. They're also useful for **setting up and cleaning up test data** faster than doing it through the UI.

---

## How complex is this project, and is this level enough for a production test automation framework?

**Date:** 2026-11-05
**Project:** petclinic-pw-pom (Playwright POM)

**Q:** What level of complexity is this project? If I learn this level of coding and test automation framework/architecture, is it good enough for a project in production?

**A:** It's a **solid foundation, at roughly junior-to-mid QA automation level**. The **architecture** is the same one real production Playwright frameworks use, so what you're learning carries over directly. What it's missing is mostly the **scale and operations** side: many environments, many testers, hundreds of tests running in parallel. Production projects add that on top of this foundation.

### What the project has now (~900 lines, 10 page objects, 19 tests)

| Area | What's here | Production-grade? |
|---|---|---|
| **Page Object Model** | 10 page/component classes, one `PageManager`, one `pom` fixture, strict conventions (inline locators, no tiny methods, entry/exit checks, `expect*` methods for goal assertions) | **Yes.** This is the most important pattern, and the conventions are stricter than many real projects |
| **Fixtures for setup/cleanup** | `restorePetTypes`, `restoreSpecialty`, `restoreVetSpecialties`, `restorePetTypeOfPets`: take a snapshot via the API, `use()`, then restore, even when a test fails | **Yes.** Cleaning up through the API in fixtures is the right approach |
| **Auth** | Global setup logs in once, saves `storageState`, gets a bearer token for API calls | **Mostly.** Real projects usually use *setup projects* (one per user role) instead of `globalSetup` |
| **Stable waiting** | Web-first assertions, `expect.poll`, no `waitForTimeout` | **Yes** |
| **Test data** | JSON files in `test-data/` | Partly; see gaps |
| **CI** | GitHub Actions on PR + `main`, container image, secrets, trace artifacts, concurrency lock | **Yes** for one environment |
| **Process** | Feature branches, PRs, changelog, debugging with traces | **Yes**, and it's how real teams work |

### What production frameworks usually add

| Gap | Why production needs it | Concept to learn |
|---|---|---|
| **Parallel runs** | The suite runs with `workers: 1` because the tests share data on one live site. At 300+ tests that's too slow | Unique data per test (e.g. `faker`, already installed but not used yet), so tests don't collide; `fullyParallel`; `--shard` across CI machines |
| **Multiple environments** | `baseURL` is hard-coded; real projects run against QA, staging, sometimes prod | `ENV=qa npx playwright test` choosing `.env.qa` / `.env.staging`, `baseURL` from env |
| **Tags** | You need fast `@smoke` on PRs and full `@regression` nightly | `{ tag: '@smoke' }` + `--grep` |
| **Multiple user roles** | Admin / normal user / read-only users | Auth setup projects + one `storageState` file per role |
| **API layer** | API calls are written inline in fixtures; the four restore fixtures are almost copies of each other | API client / service classes (`PetTypesApi.getAll()`, `.update()`), one generic snapshot-restore helper, plus actual **API tests** |
| **Retries + flaky test tracking** | Shared environments are noisy | `retries` in CI, watching the "flaky" section of the report |
| **Reporting / notifications** | Managers and devs need to see results without opening CI | Allure or HTML report published, Slack/Teams message on failure |
| **Code quality tooling** | Many people contribute | ESLint (with `eslint-plugin-playwright`), Prettier, TypeScript `strict`, no `any` (`auth-setup.ts` has two) |
| **Wider coverage** | Real users use other browsers / devices | Firefox/WebKit/mobile projects, accessibility checks (`@axe-core/playwright`), visual tests (`toHaveScreenshot`) |

### Verdict

- **Yes, this level is a good base for production.** If you can explain *why* the POM conventions, fixture cleanup, auth state and CI setup are built this way, you understand what most production frameworks are made of.
- **It isn't yet everything a senior engineer is expected to own.** The gap isn't harder coding; it's **designing for scale**: data isolation for parallel runs, multiple environments, API layers, and reporting.
- **Suggested next steps, in order:**
  1. Unique test data with `faker` + turn on parallel runs
  2. Multi-environment config
  3. `@smoke` / `@regression` tags in CI
  4. API client classes + a few API tests
  5. ESLint + TypeScript strict
  6. Sharding + merged reports in CI

---
