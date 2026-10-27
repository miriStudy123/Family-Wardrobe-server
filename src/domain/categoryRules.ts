/**
 * כללי קטגוריות — מקום מרכזי אחד לשינוי עתידי.
 *
 * חשוב: הכללים קובעים אילו קטגוריות מוצגות כברירת מחדל בלבד.
 * הם אינם מגבילים את תקינות הנתונים ואינם קשורים להרשאות גישה.
 * שינוי מגדר של ילד לעולם אינו מוחק בגדים.
 */
export const CLOTHING_CATEGORIES = ["shirt", "trousers", "skirt", "dress", "accessories"] as const;
export const SEASONS = ["summer", "winter", "all_season"] as const;
export const GENDERS = ["boy", "girl"] as const;

export type ClothingCategoryValue = (typeof CLOTHING_CATEGORIES)[number];
export type SeasonValue = (typeof SEASONS)[number];
export type GenderValue = (typeof GENDERS)[number];

const DEFAULT_DISPLAY_CATEGORIES: Record<GenderValue, readonly ClothingCategoryValue[]> = {
  boy: ["shirt", "trousers", "accessories"],
  girl: ["shirt", "trousers", "skirt", "dress", "accessories"],
};

export function getRecommendedCategories(gender: GenderValue): ClothingCategoryValue[] {
  return [...DEFAULT_DISPLAY_CATEGORIES[gender]];
}
