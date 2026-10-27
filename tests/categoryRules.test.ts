import { describe, expect, it } from 'vitest';
import { getRecommendedCategories } from '../src/domain/categoryRules';

describe('כללי קטגוריות לפי מגדר', () => {
  it('boy — חולצות, מכנסיים ואביזרים', () => {
    expect(getRecommendedCategories('boy')).toEqual(['shirt', 'trousers', 'accessories']);
  });

  it('girl — כל הקטגוריות', () => {
    expect(getRecommendedCategories('girl')).toEqual(['shirt', 'trousers', 'skirt', 'dress', 'accessories']);
  });

  it('מחזיר עותק — שינוי התוצאה אינו משנה את הכלל המרכזי', () => {
    getRecommendedCategories('boy').push('dress');
    expect(getRecommendedCategories('boy')).not.toContain('dress');
  });
});
