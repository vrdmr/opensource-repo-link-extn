import { createPopupController, type PopupState } from "./popup-controller.js";

const status = document.getElementById("status")!;
const repository = document.getElementById("repository")!;
const actions = document.getElementById("actions")!;
const buttons = [
  { button: document.getElementById("overview") as HTMLButtonElement, destination: "overview" },
  { button: document.getElementById("jit") as HTMLButtonElement, destination: "jit" },
  { button: document.getElementById("github") as HTMLButtonElement, destination: "github" },
] as const;

function render(state: PopupState): void {
  status.textContent = state.message;
  repository.textContent = state.repository;
  repository.hidden = !state.repository;
  actions.hidden = state.actions.length === 0;
  actions.setAttribute("aria-busy", String(state.kind === "opening"));
  for (const { button, destination } of buttons) {
    button.hidden = !state.actions.includes(destination);
    button.disabled = !["ready", "failed"].includes(state.kind) || button.hidden;
  }
}

const controller = createPopupController(
  {
    query: (query) => chrome.tabs.query(query),
    get: (id) => chrome.tabs.get(id),
    update: (id, properties) => chrome.tabs.update(id, properties),
    create: (properties) => chrome.tabs.create(properties),
  },
  render,
  () => window.close(),
);
for (const { button, destination } of buttons) {
  button.addEventListener("click", () => { void controller.open(destination); });
}
window.addEventListener("pagehide", () => controller.dispose());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    controller.dispose();
  }
});
void controller.load();
