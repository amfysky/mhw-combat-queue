import type { Monster } from "../types";
import DefaultMonsterImage from "../assets/unknown_monster.webp";

/**
 * 根据队列项内容解析对应的怪物图片，未匹配到时回退到默认图。
 */
export const resolveMonsterImage = (
  monsters: Monster[],
  content: string
): string => {
  return monsters.find((m) => m.name === content)?.image || DefaultMonsterImage;
};

/**
 * 计算两个字符串的Levenshtein距离
 * @param a 第一个字符串
 * @param b 第二个字符串
 * @returns 编辑距离
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // 删除
        matrix[j - 1][i] + 1, // 插入
        matrix[j - 1][i - 1] + substitutionCost // 替换
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * 计算字符串相似度（0-1之间，1表示完全相同）
 * @param a 第一个字符串
 * @param b 第二个字符串
 * @returns 相似度
 */
function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

/**
 * 找出名称或别名与指定名称匹配度最高的怪物
 * @param monsters 怪物列表
 * @param name 要匹配的名称
 * @returns 最佳匹配的怪物，如果没有匹配则返回截断的输入名称
 */
export const findBestMatchMonster = (
  monsters: Monster[],
  name: string
): Monster | undefined => {
  if (!monsters.length) return undefined;

  let bestMatch: Monster | undefined;
  let bestScore = 0;

  for (const monster of monsters) {
    // 检查怪物名称
    const nameScore = similarity(
      monster.name.toLowerCase(),
      name.toLowerCase()
    );
    if (nameScore > bestScore) {
      bestScore = nameScore;
      bestMatch = monster;
    }

    // 检查别名
    if (monster.aliases) {
      for (const alias of monster.aliases) {
        const aliasScore = similarity(alias.toLowerCase(), name.toLowerCase());
        if (aliasScore > bestScore) {
          bestScore = aliasScore;
          bestMatch = monster;
        }
      }
    }
  }

  // 如果最佳匹配的相似度低于0.75，认为没有匹配
  if (bestScore < 0.75) {
    return;
  }

  return bestMatch;
};
