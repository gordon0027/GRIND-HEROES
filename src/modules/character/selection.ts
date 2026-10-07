import type { RosterEntry } from "./model";

// The selected hero (Unity: CharactersSave.SelectedCharacterId). A per-device convenience, like the
// Unity save it mirrors: the server does not know which hero is "selected" — every action names its
// hero explicitly.

const SELECTED_KEY = "idos-heroes-selected";

export function readSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function saveSelected(id: string): void {
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch {
    // storage blocked: the choice lives for this session
  }
}

/** The saved hero while it is playable, else the first playable one, else the first at all. */
export function resolveSelected(
  list: RosterEntry[],
  savedID: string | null,
): RosterEntry | undefined {
  return (
    list.find((h) => h.id === savedID && h.state !== "locked") ??
    list.find((h) => h.state !== "locked") ??
    list[0]
  );
}
