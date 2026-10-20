import { openDB } from "idb";
import { initialState, validateBackup, type State } from "./domain";
const db = () =>
  openDB("marketing-trend-local", 1, {
    upgrade(db) {
      db.createObjectStore("workspace");
    },
  });
export async function load(): Promise<State> {
  const d = await db();
  const saved = await d.get("workspace", "state");
  if (saved) return validateBackup(saved);
  const s = initialState();
  await d.put("workspace", s, "state");
  return s;
}
export async function save(s: State) {
  const d = await db();
  await d.put("workspace", s, "state");
}
