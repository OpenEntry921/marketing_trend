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
  if (saved) {
    const migrated = validateBackup(saved);
    if (saved.version !== migrated.version) {
      const tx = d.transaction("workspace", "readwrite");
      await tx.store.put(saved, "before-v2-migration");
      await tx.store.put(migrated, "state");
      await tx.done;
    }
    return migrated;
  }
  const s = initialState();
  await d.put("workspace", s, "state");
  return s;
}
export async function save(s: State) {
  const d = await db();
  await d.put("workspace", validateBackup(s), "state");
}
