# Fair Oaks Soccer Club U6 Team Hub

The live team hub is a small, framework-free MVVM application backed by Firebase Authentication and Cloud Firestore.

Live app: https://fair-oaks-u6-team-hub.web.app

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. A production bundle can be checked with:

```bash
npm run build
npm run preview
```

Opening `index.html` directly is no longer supported because the application uses JavaScript modules.

## Architecture

```text
src/
  models/
    team-hub-model.js       Data shape, migration, and persistence
  viewmodels/
    app-view-model.js       UI state, derived values, and commands
  views/
    shell-view.js           App shell, navigation, and composition
    roster-import-view.js   Coach preview and confirmation workflow
    event-dialog-view.js    One-time and recurring event editor
    coach-view.js           Coach dashboard, development, roster, settings
    season-playbook-view.js 13-week curriculum and drill-card PNG workflow
    shared-view.js          Schedule, RSVP, and volunteers
    family-view.js          Family home and player story
    dialog-view.js          Create/edit forms
    templates/              Static markup grouped by feature
  shared/
    format.js               Formatting and safe HTML helpers
  firebase/
    auth-manager.js         Auth session and membership loading
    firestore-manager.js    Reusable CRUD, query, batch, and listener API
    firestore-model.js      Explicit model and collection definitions
    team-hub-repository.js  Team-specific data access
    storage/media services  Validated file upload boundary
  main.js                   Dependency wiring only
  import/
    roster-importer.js      CSV/XLSX parsing and validation
  data/
    season-playbook.js      Token domains, 30 drills, and 26 practice plans
```

The dependency direction is:

```text
Views → AppViewModel → TeamHubModel
```

- Views render state and translate browser events into view-model commands.
- The view-model owns navigation, selection, computed values, and mutations.
- The model owns data loading, normalization, migration, and saving.
- `main.js` constructs the layers and connects them.

Every file under `src/views` is kept below 200 lines. New features should receive their own view rather than expanding an unrelated one.

## Firebase setup

The Firebase project is `fair-oaks-u6-team-hub`. Its default Firestore database uses the `nam5` multi-region. Google, Email/Password, and passwordless email-link Authentication are enabled, and the deployed app derives the signed-in user's role and family from `teams/{teamId}/members/{uid}`. The prototype role and family selectors are not available in authenticated sessions.

Google is the primary sign-in method and opens directly from the user’s click. The app intentionally uses Firebase’s popup flow instead of full-page redirects so Safari and other browsers that partition third-party storage do not lose the authentication session. If a browser blocks the window, the UI asks the user to allow pop-ups for the team site and try again. Invited users may open **Account** after signing in to connect Google or set/update a password. Email links remain available as a fallback, with quota-specific guidance when Firebase's daily sending limit is reached.

Copy `.env.example` to `.env` and provide the Firebase web app values for a new environment. The local `.env` is ignored by Git.

The Summit Pro service mapping is documented in [docs/SUMMIT-PRO-FIREBASE-MAPPING.md](docs/SUMMIT-PRO-FIREBASE-MAPPING.md).

## Access model

- A verified email address must have an active document at `teams/{teamId}/invites/{email}`.
- The first successful email-link sign-in creates only that user's prescribed membership document.
- Coaches can manage team content and private coaching observations.
- Guardians can read only explicitly assigned players (plus legacy family assignments), shared observations for those players, their players' RSVPs, and team-wide schedule/volunteer information.
- Everything else is denied by default in `firestore.rules`.

## Guardian relationships

The head coach can open any player from **Roster** and use the **Guardians** section to add a name, email, and relationship (`parent`, `grandparent`, `other family`, or `friend`). The app creates:

- A player-scoped guardian relationship at `teams/{teamId}/guardians/{guardianId}`.
- An allow-list invitation at `teams/{teamId}/invites/{email}` containing the permitted `playerIds` and `guardianIds`.
- Updated access on an existing member immediately, or the same scoped access when a newly invited person first signs in.

Each relationship grants access only to the named player's shared development story and stats. Revoking a relationship removes that player and conversation from the invitation and any existing membership, while preserving other player relationships held by the same email.

The roster distinguishes an outstanding **Invited** relationship from a **Joined** guardian account. A successful authenticated session updates `members/{uid}.lastLoginAt`, which coaches can see beside that guardian. Existing memberships created before this field was introduced show “Last login not recorded yet” until the account signs in again. Guardians can update only their own login timestamp and cannot read another guardian's membership activity.

## Roster import

The head coach can choose **Import roster** from the dashboard or open **Data**. CSV and `.xlsx` files must contain these columns:

```text
Athlete Last Name | Athlete First Name | Gender | Birthdate | Parent Email | Parent Phone
```

Files are parsed locally and previewed before import. The importer accepts ISO and common U.S. birthdates, detects existing athletes, skips duplicates within the file, and limits each batch to 100 athletes/5 MB. Confirming the preview writes normalized family and player documents and creates a guardian invitation for each unique parent email. Existing coach invitations are never replaced.

## Recurring practices

The Schedule event editor supports one event or a weekly series with explicit start/end dates and any weekday combination. The live preview reports the exact number of occurrences, first and last dates, shared time, and location before saving. Recurring events carry a series ID and original occurrence date so coaches can:

- Edit or delete one occurrence without changing the rest of the series.
- Edit the entire series, reconciling added and removed dates while applying the shared details to every occurrence.
- Delete the entire series after a confirmation that states exactly how many events will be removed.

Series creation, replacement, and deletion use Firestore batches and are limited to 100 occurrences.

### RSVP capacity

The event editor lets a coach set **Total RSVP slots** from 1–200, or use `0` for an unlimited event. Limited events keep one slot document per available place at `teams/{teamId}/events/{eventId}/slots/{slotId}`. Existing attending players retain a place when capacity changes, and the coach cannot reduce capacity below current attendance.

Guardians see remaining availability on the family home and full Schedule. Choosing **Going** atomically claims an open slot and saves the player's RSVP; concurrent claims cannot take the same place. The interface then marks the player **Attending**, while the RSVP selector remains editable. Changing to **Maybe** or **Not going** atomically releases the slot for another family.

Firestore rules require the RSVP and slot claim or release to agree in the same atomic write. Guardians can change only the RSVP/slot for a player assigned to their account, while coaches retain event and capacity management access.

The coach-facing **Practice Sessions** view is derived from Schedule events: only events whose type is `Practice` appear. Attendance, focus areas, and reflections are stored as session records linked by `eventId`; schedule details remain controlled by the event. Existing unlinked session records are recovered by matching their practice date and title when possible.

## Season curriculum and drill cards

The **Season Plan** contains 26 complete practices: two sessions per week for 13 weeks. Every session totals exactly 60 minutes and follows a stable U6 rhythm:

- 8 minutes of player-led arrival play
- A 3-minute story invitation
- Two 10-minute adventures separated by a 2-minute water reset
- 10 minutes of finishing and brave-shot repetition
- 14 minutes of small-sided soccer
- A 3-minute token reflection

The four token domains are Teamwork (green/black), Love of the Game (red), Brave Shots (yellow), and Tactics (blue). Tokens recognize an observable choice—helping, joyful engagement, attempting something bold, or noticing the game. They are never awards for the “best” child, goals scored, speed, or comparison.

Scheduled Practice events map chronologically to the 26-session curriculum and link directly to the appropriate lesson. The **Drill Cards** library provides 30 complete text cards with setup, equipment, story, play instructions, coaching invitations, progressions, and token opportunities.

### Today’s Practice and Field Mode

The coach dashboard automatically selects today’s non-canceled Practice event. When there is no practice today, it previews the next scheduled practice instead. Coaches can also use the practice picker to preview any past or future active session without changing the schedule. Canceled practices do not consume a lesson in the 26-session curriculum.

**Start Field Mode** opens a full-screen sideline interface with:

- A scrollable practice selector plus previous/next session controls
- The current practice block and large countdown timer
- Start/pause, next, back, reset, and direct block-jump controls
- The current drill’s story, setup, instructions, and short coaching invitations
- The session’s token opportunity and observable behavior prompt
- Whole-practice progress based on elapsed block time
- Screen Wake Lock support where the browser and device allow it

The Field Mode timer uses a wall-clock deadline rather than subtracting interval ticks, so it stays accurate if the browser briefly throttles updates. It is intentionally temporary coaching state: closing Field Mode does not alter attendance, session notes, or the team schedule.

PNG artwork can be added without editing code: place a file in `src/assets/drill-cards/` using the drill ID shown on its live card, such as `gates-galore.png`. Vite discovers matching files automatically on the next build. Use a consistent 4:3 landscape canvas and keep each image under 5 MB.

The secure in-app upload workflow is also implemented, but new Firebase Storage buckets now require the paid Blaze plan. This project is currently on Spark, so `.env` keeps `VITE_FIREBASE_STORAGE_ENABLED=false`. If billing and Storage are later enabled, change it to `true`; coach uploads will use `coachTeams/{teamId}/drill-cards/{drillId}`, while Firestore stores image metadata in `teams/{teamId}/drillCards/{drillId}`. The text playbook never depends on artwork or Storage.

## Messaging and broadcasts

The Messages area has two intentionally separate channels:

- Coaches can publish team-wide broadcasts. Every active member can read them; guardians cannot create them.
- Each player–guardian relationship has its own private coach conversation. Two guardians assigned to the same player cannot read one another's messages. Legacy family conversations remain readable for existing family-based memberships.

There is no parent-to-parent recipient picker or data path. Firestore rules enforce the same boundary independently of the interface. Messages update live while the app is open.

The first team document and head-coach invite can be recreated by an authorized Firebase operator with:

```bash
FIREBASE_ACCESS_TOKEN="$(gcloud auth print-access-token)" npm run bootstrap:team -- coach@example.com
```

The bootstrap script reads the ignored private seed only for the team name, philosophy, and skill framework. It does not upload players or contact details.

## Verification and deployment

```bash
PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npm run test:rules
npm test
npm run build
firebase deploy --only firestore,hosting
```

The rules tests run against the Firebase emulator and cover anonymous denial, family isolation, private observations, atomic RSVP slot claims/releases, volunteer claims, coach access, and invite-controlled membership creation.

## Privacy

The private roster is stored only in the ignored `private/` directory. The deployable `team-data.json` is sanitized and contains no players, family email addresses, or phone numbers. Do not move private seed data into `src/`, `dist/`, or another deployable path.
