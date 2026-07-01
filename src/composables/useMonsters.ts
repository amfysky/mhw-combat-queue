import { ref, watch } from "vue";
import type { Monster } from "../types";
import { db } from "../utils/db";
import { broadcastMonsters } from "../utils/broadcast";

/**
 * 怪物列表状态：从 IndexedDB 加载，并在列表变更时广播到展示页。
 */
export function useMonsters() {
  const monsters = ref<Monster[]>([]);

  watch(
    monsters,
    () => broadcastMonsters(monsters.value),
    { deep: true }
  );

  const load = async () => {
    monsters.value = await db.getAllMonsters();
  };

  return { monsters, load };
}
