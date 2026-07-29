# Summit Pro Firebase → Team Hub Web Mapping

The web layer keeps Summit Pro's separation of concerns while using Firebase's modular JavaScript SDK.

| Summit Pro | Team Hub web | Translation |
|---|---|---|
| `FirestoreModel` protocol | `defineFirestoreModel()` | Defines collection paths and encode/decode behavior. Web paths accept context for team and player subcollections. |
| `FirestoreManager.shared` | `FirestoreManager` instance | Async CRUD, compound queries, existence checks, batches, transactions, and listeners. It is dependency-injected instead of global. |
| `AuthManager.shared` | `AuthManager` | Observes auth state, exposes UID/status/profile, loads a membership document, and signs out. |
| `SignInViewModel` | Future `LoginViewModel` | Form validation, loading, and friendly errors belong in the view-model. Firebase calls stay in `AuthManager`. |
| `FirebaseStorageManager` | `FirebaseStorageManager` | Uploads a `File`/`Blob`, sets content type, and returns path plus download URL. |
| `FirebaseMediaService` | `MediaService` | Validates browser-selected files, creates safe unique paths, and uploads them. |
| `BroadcastService` | `BroadcastService` | Adds targeted team broadcasts with server timestamps. |

## Intentional differences

- Firestore failures throw. They are not converted into `[]` or `nil`, so the UI can distinguish “empty” from “offline/denied/failed.”
- Collection names are explicit. Automatically pluralizing JavaScript class names is fragile and does not model nested team data.
- Membership is loaded after Firebase Auth resolves. A signed-in user without an active membership becomes `unauthorized`, not an authenticated coach or guardian.
- Registration is not ported. This team app should be invite-only; public `createUser` would allow unapproved accounts.
- Email-link login is supported alongside Summit Pro's email/password flow.
- Security Rules remain authoritative. The profile, role, and route selected by JavaScript are never sufficient authorization.
- Storage paths include the authenticated owner ID and require matching Storage Rules.

## Activation

1. Copy `.env.example` to `.env` and add the Firebase web-app configuration.
2. Create the team and `teams/{teamId}/members/{uid}` membership documents.
3. Add and test Firestore and Storage Security Rules.
4. Instantiate `createFirebaseServices()` during bootstrap.
5. Add `LoginViewModel` and small login views that react to `AuthManager` state.
6. Replace the local `TeamHubModel` with an async model backed by `TeamHubRepository`.

The service layer is deliberately not activated by the current prototype. Supplying configuration alone must not upload the embedded roster or make an unauthenticated database request.
