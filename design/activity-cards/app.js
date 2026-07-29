import { drillLibrary, tokenById } from "../../src/data/season-playbook.js";
import { renderDiagram } from "./diagrams.js";

const card = document.querySelector("#card");
const params = new URLSearchParams(location.search);
const drillId = params.get("id") || "team-gates";
const item = drillLibrary.find(value => value.id === drillId) || drillLibrary[0];
const token = tokenById(item.tokenIds[0]);

const themes = {
  teamwork: { color: "#16944a", deep: "#0a4e29", ink: "#ffffff", mark: "T" },
  love: { color: "#d74436", deep: "#752018", ink: "#ffffff", mark: "♥" },
  brave: { color: "#f2c12e", deep: "#8c6800", ink: "#111111", mark: "★" },
  tactics: { color: "#2878d0", deep: "#123f7c", ink: "#ffffff", mark: "◆" },
};

const theme = themes[token.id];
card.style.setProperty("--domain", theme.color);
card.style.setProperty("--domain-deep", theme.deep);
card.style.setProperty("--domain-ink", theme.ink);

card.innerHTML = `
  <header class="card-header">
    <div>
      <div class="eyebrow"><span class="domain-dot">${theme.mark}</span>${token.name} · ${item.category}</div>
      <h1>${item.title}</h1>
      <p class="story">${item.story}</p>
    </div>
    <div class="brand-seal"><div><strong>FAIR OAKS</strong><span>U6 SOCCER</span></div></div>
  </header>
  <section class="card-grid">
    <div class="diagram-panel">
      <div class="diagram-heading"><strong>Field picture</strong><span>Follow the shapes—not the scale</span></div>
      ${renderDiagram(item.id, theme)}
    </div>
    <aside class="info-panel">
      <section class="info-block">
        <h2 class="info-label">Set it up</h2>
        <p>${item.setup}</p>
      </section>
      <section class="info-block">
        <h2 class="info-label">How it plays</h2>
        <p>${item.play}</p>
      </section>
      <section class="info-block">
        <h2 class="info-label">Say less. Try:</h2>
        <ul class="cue-list">${item.cues.map(cue => `<li>“${cue}”</li>`).join("")}</ul>
      </section>
      <section class="token-callout">
        <strong>${token.name} token opportunity</strong>
        <p>${token.coachLooksFor}</p>
      </section>
    </aside>
  </section>
  <footer class="footer"><span>Fair Oaks Soccer · Coach Activity Card</span><span>${item.id}.png</span></footer>
`;

document.documentElement.dataset.ready = "true";
