


# Freshworks Platform 3.0 App Development Workshop

**Quick guide: Use AI + app-dev skill to create Freshworks apps with prompts**

---

## Prerequisites

### Required Tools

1. **Node.js 18.x**
   ```bash
   node --version  # Should be 18.20.8 or compatible
   ```

2. **FDK (Freshworks Development Kit) 9.x**
   
   https://developers.freshworks.com/docs/guides/setup/cli-setup/

3. **Cursor IDE** 

---

## Workshop Setup

### Step 1: Install FDK

Use the official docs as mentioned above. 

*Note*: Feel free to aditionally **test** the `fdk-setup` skill using the command

```bash
npx skills add https://github.com/freshworks-developers/marketplace --skill fdk-setup
```

### Step 2: Create Project Folder

```bash
mkdir my-freshworks-app
cd my-freshworks-app
```

### Step 3: Install app-dev Skill in Project

As mentioned in https://github.com/freshworks-developers/marketplace which lists 2 more skills.

Add the main `app-dev` skill for workshop

```bash
npx skills add https://github.com/freshworks-developers/marketplace --skill app-dev
```

This installs the `app-dev` skill from the official Freshworks marketplace repository.

### Step 4: Configure Cursor Permissions

1. Open Cursor IDE
2. Go to Settings → Features → Agent
3. **Allow all permissions** when prompted (file read/write, shell access)
4. This lets the skill auto-generate and validate files

### Step 5: Verify Cursor Settings

1. Once installed you should be able to rules/skills in settings. 

---

## Step-by-Step App Creation

### Step 1: Enter Your Prompt

Open Cursor AI chat and describe your app. Refer to the `workshop apps sheet`

**Simple Frontend App:**
```
Create a Freshdesk ticket sidebar app that displays "Hello World" 
using Crayons components. Name it "hello-world-app".
```

**App with External API:**
```
Create a Freshservice ticket sidebar app with a button "Get Random Fact" 
that calls https://uselessfacts.jsph.pl/random.json and displays the result.
Name it "random-facts-app".
```

**OAuth Integration:**
```
Create a Freshdesk ticket sidebar app that uses GitHub OAuth to fetch 
and display the user's repositories. Name it "github-repos-app".
```

### Step 2: AI Generates App

The AI assistant will:

1. ✅ Read the `app-dev` skill
2. ✅ Generate all required files (manifest, frontend, backend, configs)
3. ✅ Run `fdk validate` automatically
4. ✅ Attempt to fix errors (up to 6 iterations)
5. ✅ Report final status

**You do NOT need to:**
- ❌ Read skill files manually
- ❌ Understand Platform 3.0 rules
- ❌ Fix validation errors yourself
- ❌ Know manifest structure

### Step 3: Review Generated Files

**Scan through key files:**
- `manifest.json` - App configuration
- `app/index.html` - Frontend UI
- `app/scripts/app.js` - Frontend logic
- `server/server.js` - Backend logic (if hybrid/serverless)
- `config/` - Configuration files

### Step 4: Report Errors (Do NOT Fix)

If you encounter errors:

1. **Copy the full error message**
2. **Paste it in the chat**
3. **Describe what you were doing**
4. **Let the AI analyze and provide feedback**

**Example:**
```
I ran `fdk run` and got this error:
[Error message here]

I was trying to test the app in Freshdesk ticket sidebar.
```

The AI will provide feedback on what went wrong, but **you are not expected to fix it yourself**.

### Step 5: Manual fix

Ask AI "fix the errors in the app"

---

## What Happens Behind the Scenes

The `app-dev` skill automatically handles:

### Platform 3.0 Compliance
- ✅ Correct manifest structure (`"platform-version": "3.0"`, `"modules"` not `"product"`)
- ✅ Request templates (FQDN hosts, correct paths)
- ✅ Crayons components (not plain HTML)
- ✅ Mandatory files (icon.svg, iparams.json)

### Security Enforcement
- ✅ Input validation for all server functions
- ✅ Safe logging (no credentials in logs)
- ✅ XSS prevention (sanitized DOM updates)
- ✅ Secure data handling

### Code Quality
- ✅ Async/await correctness
- ✅ Function complexity ≤ 7
- ✅ No unused parameters
- ✅ Proper error handling

### Validation & Auto-Fix
- ✅ Runs `fdk validate` automatically
- ✅ Fixes common errors (up to 6 iterations)
- ✅ Reports final status

---

## Common Errors You Might See

If the AI reports errors after generation:

### 1. Missing icon.svg
```
Error: Icon 'app/styles/images/icon.svg' not found
```
**What it means:** Frontend apps must have an icon file.
**What to do:** Report this to the feedback - it should have been auto-generated.

### 2. Async without await
```
Lint Error: Async function has no 'await' expression
```
**What it means:** Function has `async` keyword but doesn't use `await`.
**What to do:** Report this to the feedback.

### 3. Function complexity > 7
```
Warning: Function has complexity 12. Maximum allowed is 7.
```
**What it means:** Function is too complex (too many conditions).
**What to do:** Report this to the feedback.

### 4. Host must be FQDN
```
Error: schema/host must be FQDN without path
```
**What it means:** API host includes path (should be domain only).
**What to do:** Report this to the feedback.

### 5. App not appearing in sidebar
**What it means:** App doesn't show up after `fdk run`.
**What to do:**
1. Check if `fdk run` is still running
2. Verify URL has `?dev=true` parameter
3. Report the issue with error logs

---

**What You Do:**
1. ✅ Install FDK
2. ✅ Install skill in project
3. ✅ Allow all permissions in Cursor
4. ✅ Enter a prompt describing your app
5. ✅ Review generated files
6. ✅ Run `fdk run` to test
7. ✅ Report errors (don't fix them yourself)

**What the AI Does:**
1. ✅ Reads skill files and rules
2. ✅ Generates Platform 3.0 compliant code
3. ✅ Enforces security patterns
4. ✅ Validates and auto-fixes errors
5. ✅ Provides feedback on issues

**You DON'T need to:**
- ❌ Read skill documentation
- ❌ Understand Platform 3.0 rules
- ❌ Know manifest structure
- ❌ Fix validation errors manually
- ❌ Write security checks




