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
import { AdminWorkspaceModel } from "./models/admin-workspace-model.js";
import { FirestoreAdminModel } from "./models/firestore-admin-model.js";
import { AdminViewModel } from "./viewmodels/admin-view-model.js";
import { AdminView } from "./views/admin-view.js";

const root = document.querySelector("#app");
const demoMode = new URLSearchParams(window.location.search).get("admin-demo") === "1";
const services = demoMode ? null : createFirebaseServices();
const loginViewModel = services ? new LoginViewModel(services.auth) : null;
const loginView = services ? new LoginView(root, loginViewModel) : null;
let renderVersion = 0;

const workspaceModes = [
  { id: "admin", label: "Admin" },
  { id: "coach", label: "Coach" },
  { id: "parent", label: "Parent" },
];

function requestedAdminWorkspace(snapshot) {
  if (snapshot.profile?.role !== "clubAdmin" || snapshot.profile?.active === false) return null;
  const requested = new URLSearchParams(window.location.search).get("workspace") || "admin";
  return workspaceModes.some(item => item.id === requested) ? requested : "admin";
}

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
    const workspace = requestedAdminWorkspace(snapshot);
    if (workspace === "admin" || (snapshot.profile.role === "clubAdmin" && !workspace)) {
      const model = await FirestoreAdminModel.create(services.adminRepository);
      if (version !== renderVersion) return;
      new AdminView(root, new AdminViewModel(model, { user: snapshot.user, membership: snapshot.profile }), services.auth, workspaceController("admin")).mount();
      return;
    }
    const memberWorkspace = workspace || requestedMemberWorkspace(snapshot);
    const dataMembership = workspace ? { ...snapshot.profile, role: "headCoach", familyId: null, playerIds: [], guardianIds: [] } : snapshot.profile;
    const model = await FirestoreTeamHubModel.create(services.repository, dataMembership);
    if (version !== renderVersion) return;
    const identity = { user: snapshot.user, membership: snapshot.profile };
    const viewModel = new AppViewModel(model, identity, { media: import.meta.env.VITE_FIREBASE_STORAGE_ENABLED === "true" ? services.media : null, teamId: services.repository.teamId, experienceRole: memberWorkspace === "parent" ? "family" : memberWorkspace === "coach" ? "coach" : null, superUser: Boolean(workspace) });
    const dialogs = new DialogView(root, viewModel);
    const eventDialog = new EventDialogView(root, viewModel);
    const fieldMode = new FieldModeView(root, viewModel, new FieldModeViewModel());
    const views = [new CoachView(root, viewModel, dialogs, fieldMode), new SeasonPlaybookView(root, viewModel), new MessageView(root, viewModel), new SharedView(root, viewModel, dialogs, eventDialog), new FamilyView(root, viewModel), new RosterImportView(root, viewModel), new AccountView(root, services.auth), fieldMode, dialogs, eventDialog];
    const modeController = workspace
      ? workspaceController(workspace)
      : memberWorkspace ? { ...workspaceController(memberWorkspace), modes: workspaceModes.filter(item => item.id !== "admin") } : null;
    new ShellView(root, viewModel, views, services.auth, modeController).mount();
  } catch (error) {
    root.innerHTML = `<main class="login-shell"><section class="login-card"><p class="eyebrow dark">Fair Oaks Soccer Club</p><h1>Could not load the team</h1><p class="login-intro"></p><p class="login-message error"></p><div class="button-row"><button class="button primary" data-action="retry-team">Try loading again</button><button class="button" data-action="sign-out">Sign out</button></div></section></main>`;
    root.querySelector(".login-intro").textContent = `${snapshot.user?.email || "Your account"} is signed in and has team access, but the team data did not finish loading.`;
    root.querySelector(".login-message").textContent = error.message;
    root.querySelector("[data-action=retry-team]").addEventListener("click", () => renderSession(services.auth.snapshot));
    root.querySelector("[data-action=sign-out]").addEventListener("click", () => services.auth.signOut());
  }
}

if (demoMode) {
  const model = new AdminWorkspaceModel();
  new AdminView(root, new AdminViewModel(model, { user: { uid: "admin-demo", email: "admin@fairoakssoccer.org" }, membership: { role: "clubAdmin" } }, { demo: true })).mount();
} else {
  services.auth.addEventListener("change", event => renderSession(event.detail));
  renderSession();
  if (services.auth.isEmailLink()) {
    services.auth.completeEmailLink()
      .then(completed => { if (completed) window.history.replaceState({}, document.title, window.location.pathname); })
      .catch(() => loginView.mount());
  }
}
