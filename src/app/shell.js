const VIEWS = ["build", "program", "scale", "operate"];

export function initAppShell() {
  const tabs = document.querySelectorAll("[data-app-tab]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.appTab));
  });
  if (location.hash) {
    let h = location.hash.replace("#", "");
    if (h === "size") h = "scale";
    if (h === "path") h = "operate";
    if (VIEWS.includes(h)) setView(h);
    else setView("build");
  } else {
    setView("build");
  }
}

export function getActiveView() {
  return document.querySelector(".app-view.is-active")?.dataset.view ?? "build";
}

export function setView(name) {
  if (!VIEWS.includes(name)) name = "build";
  document.querySelectorAll(".app-view").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.view === name);
  });
  document.querySelectorAll("[data-app-tab]").forEach((tab) => {
    const on = tab.dataset.appTab === name;
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.classList.toggle("active", on);
  });
  history.replaceState(null, "", `#${name}`);
  document.dispatchEvent(new CustomEvent("app-view-change", { detail: { view: name } }));
}
