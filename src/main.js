import { createFirebaseServices } from "./firebase/create-firebase-services.js";
import { FirestoreTeamHubModel } from "./models/firestore-team-hub-model.js";
import { AppViewModel } from "./viewmodels/app-view-model.js";
import { LoginViewModel } from "./viewmodels/login-view-model.js";
import { ShellView } from "./views/shell-view.js";
import { CoachView } from "./views/coach-view.js";
import { SharedView } from "./views/shared-view.js";
import { FamilyView } from "./views/family-view.js";
import { DialogView } from "./views/dialog-view.js";
import { LoginView } from "./views/login-view.js";
import { RosterImportView } from "./views/roster-import-view.js";
import { EventDialogView } from "./views/event-dialog-view.js";
import { MessageView } from "./views/message-view.js";
import { AccountView } from "./views/account-view.js";
import { SeasonPlaybookView } from "./views/season-playbook-view.js";
import { FieldModeViewModel } from "./viewmodels/field-mode-view-model.js";
import { FieldModeView } from "./views/field-mode-view.js";

const root = document.querySelector("#app");
const services = createFirebaseServices();
const loginViewModel = new LoginViewModel(services.auth);
const loginView = new LoginView(root, loginViewModel);
let renderVersion = 0;

const workspaceModes = [
  { id: "coach", label: "Coach" },
  { id: "parent", label: "Parent" },
];

function requestedMemberWorkspace(snapshot) {
  const profile = snapshot.profile;
  const isCoach = ["headCoach", "assistantCoach"].includes(profile?.role);
  const hasParentAccess = Boolean(profile?.familyId || profile?.playerIds?.length || profile?.guardianIds?.length);
  if (!isCoach || !hasParentAccess) return null;
  return new URLSearchParams(window.location.search).get("workspace") === "parent" ? "parent" : "coach";
}

function workspaceController(current) {
  return {
    current, modes: workspaceModes,
    change(mode) {
      if (!workspaceModes.some(item => item.id === mode) || mode === current) return;
      const url = new URL(window.location.href); url.searchParams.set("workspace", mode); window.location.href = url.toString();
    },
  };
}

async function renderSession(snapshot = services.auth.snapshot) {
  const version = ++renderVersion;
  if (snapshot.status !== "ready") { loginView.mount(); return; }
  root.innerHTML = `<main class="login-shell"><div class="login-card">Loading your team…</div></main>`;
  try {
    const workspace = requestedMemberWorkspace(snapshot);
    const model = await FirestoreTeamHubModel.create(services.repository, snapshot.profile);
    if (version !== renderVersion) return;
    const identity = { user: snapshot.user, membership: snapshot.profile };
    const viewModel = new AppViewModel(model, identity, { media: import.meta.env.VITE_FIREBASE_STORAGE_ENABLED === "true" ? services.media : null, teamId: services.repository.teamId, experienceRole: workspace === "parent" ? "family" : workspace === "coach" ? "coach" : null });
    const dialogs = new DialogView(root, viewModel);
    const eventDialog = new EventDialogView(root, viewModel);
    const fieldMode = new FieldModeView(root, viewModel, new FieldModeViewModel());
    const views = [new CoachView(root, viewModel, dialogs, fieldMode), new SeasonPlaybookView(root, viewModel), new MessageView(root, viewModel), new SharedView(root, viewModel, dialogs, eventDialog), new FamilyView(root, viewModel), new RosterImportView(root, viewModel), new AccountView(root, services.auth), fieldMode, dialogs, eventDialog];
    new ShellView(root, viewModel, views, services.auth, workspace ? workspaceController(workspace) : null).mount();
  } catch (error) {
    root.innerHTML = `<main class="login-shell"><section class="login-card"><p class="eyebrow dark">Fair Oaks Soccer Club</p><h1>Could not load the team</h1><p class="login-intro"></p><p class="login-message error"></p><div class="button-row"><button class="button primary" data-action="retry-team">Try loading again</button><button class="button" data-action="sign-out">Sign out</button></div></section></main>`;
    root.querySelector(".login-intro").textContent = `${snapshot.user?.email || "Your account"} is signed in and has team access, but the team data did not finish loading.`;
    root.querySelector(".login-message").textContent = error.message;
    root.querySelector("[data-action=retry-team]").addEventListener("click", () => renderSession(services.auth.snapshot));
    root.querySelector("[data-action=sign-out]").addEventListener("click", () => services.auth.signOut());
  }
}

services.auth.addEventListener("change", event => renderSession(event.detail));
renderSession();
if (services.auth.isEmailLink()) {
  services.auth.completeEmailLink()
    .then(completed => { if (completed) window.history.replaceState({}, document.title, window.location.pathname); })
    .catch(() => loginView.mount());
}
