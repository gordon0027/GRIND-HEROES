// ПЕРВЫЙ импорт сознательно: зонд превью ставит перехват console/ошибок при загрузке своего
// модуля, и всё, что упадёт ниже по старту (включая config.ts на нераспознанном тайтле), уже
// попадёт в его лог — а значит доедет до AI-кодера. Вне превью не делает ничего.
import { installPreviewProbe } from "./previewProbe";
import { createIDosGamesClient } from "@idosgames/core";
import { mountHost } from "@idosgames/app-shell";
import { baseModule, LoginScreen, PlayAccessScreen } from "./base";
import { modules } from "./modules";
import { TITLE_ID, BUILD_KEY } from "./config";
import { IS_DEV } from "./env";
import ui from "./ui.config";

// Тайтл зонду — отдельным вызовом: сам он встал раньше, чем config.ts успел его разрешить.
installPreviewProbe({ titleId: TITLE_ID });

const app = document.getElementById("app");
if (!app) throw new Error("#app container not found");

// Always runs against the real backend (https://api.idosgames.com) via the global fetch.
const client = createIDosGamesClient({
  titleID: TITLE_ID,
  buildKey: BUILD_KEY.length > 0 ? BUILD_KEY : undefined,
  throttleMs: 0,
});

client.on("error:global", (message) => {
  console.error("[idos] global error:", message);
});
client.on("error:connection", (message) => {
  console.error("[idos] connection error:", message);
});

if (IS_DEV) {
  (
    globalThis as typeof globalThis & { idosClient?: typeof client }
  ).idosClient = client;
}

// The host owns sign-in: mountHost replays the previous session (autoLogin) and, when there is
// none, renders the login screen. Do NOT log in here — that would skip the screen, and with it the
// player's ability to pick a provider or switch accounts.
//
// The app = the base (./base: sign-in and the lobby) + the modules of ./modules.ts (the shop, heroes,
// leaderboards… and the games). The base goes first; what happens after sign-in is ./app.config.ts.
//
mountHost({
  container: app,
  client,
  modules: [baseModule, ...modules],
  renderLogin: (props) => <LoginScreen {...props} />,
  // Shown instead of the app when the title's login mode requires a token balance the player has
  // not confirmed yet (see ./base/login/PlayAccessScreen).
  renderPlayAccess: (props) => <PlayAccessScreen {...props} />,
  // Look, animations and sounds of every module's interface — edit ./ui.config.ts, not the modules.
  ui,
});
