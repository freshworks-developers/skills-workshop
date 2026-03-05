# Development Notes — Freshdesk → Supabase Ticket Snapshot App

A running log of issues encountered during development and the fixes applied.

---

## Issue 1 — `type_attributes` not supported in Platform 3.0 iparams

**File:** `config/iparams.json`

**Error:**
```
✖ Found unsupported key 'type_attributes' in supabase_project_ref. type_attributes is not supported from platform version 3.0
✖ Found unsupported key 'type_attributes' in table_name. type_attributes is not supported from platform version 3.0
```

**Root cause:**  
`type_attributes` (used for regex validation) was a Platform 2.x feature and is no longer accepted in Platform 3.0 `iparams.json`.

**Fix:**  
Removed the `type_attributes` block from both `supabase_project_ref` and `table_name`. Moved the validation hint (format guidance) into the `description` field so the admin still sees the expected format during installation.

---

## Issue 2 — Invalid icon dimensions for `ticket_sidebar`

**File:** `app/styles/images/icon.svg`

**Error:**
```
✖ Invalid dimension of icon 'styles/images/icon.svg' for ticket_sidebar
```

**Root cause:**  
The SVG was defined with a `viewBox="0 0 40 40"` but did not carry explicit `width` and `height` attributes. The FDK validator requires the icon to be exactly **64 × 64 px** for the `ticket_sidebar` location.

**Fix:**  
Added `width="64" height="64"` to the `<svg>` element and updated the `viewBox` to `"0 0 64 64"`. Scaled all internal paths/shapes to fit the new canvas.

---

## Issue 3 — `var` declarations rejected by the FDK linter

**Files:** `app/scripts/app.js`, `server/server.js`

**Errors (23 total):**
```
✖ app/scripts/app.js::5: Unexpected var, use let or const instead.
✖ server/server.js::10: Unexpected var, use let or const instead.
... (21 more)
```

**Root cause:**  
The FDK linter enforces ES6+ style. `var` is disallowed; `let` and `const` are required.

**Fix:**  
Replaced every `var` declaration with `const` (for values that are never reassigned) or `let` (for the `client` variable that is assigned after declaration). 23 occurrences across both files.

---

## Issue 4 — "Cannot set headers after they are sent to the client"

**File:** `server/server.js`

**Error:**
```
Error: Cannot set headers after they are sent to the client
    at renderData (framework.js:220:20)
    at Object.onTicketCreateHandler (server.js:666:7)
```

**Root cause:**  
In Freshworks Platform 3.0, when an event handler is declared `async`, the FDK framework **automatically calls `renderData()`** when the returned promise resolves. Calling `renderData()` explicitly *inside* the async function sends the HTTP response once, then the framework tries to send it again when the promise settles → duplicate headers error.

**Fix:**  
Removed all explicit `renderData()` calls from `async` handlers (`onTicketCreateHandler`, `onAppInstallHandler`). The framework resolves the response via promise completion.

For the install-blocking error case in `onAppInstallHandler`, replaced `renderData(new Error(...))` with `throw new Error(...)` — the framework catches the rejection and surfaces the message to the admin.

The synchronous `onAppUninstallHandler` keeps its explicit `renderData()` call, which is still required for sync handlers.

**Rule going forward:**

| Handler type | Signal success | Signal error |
|---|---|---|
| `async function` | `return` (or fall off end) | `throw new Error(...)` |
| `function` (sync) | `renderData()` | `renderData(new Error(...))` |
