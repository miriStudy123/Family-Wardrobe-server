/**
 * הפרדה בין שדות שילד רשאי לעדכן בפריט לבוש לבין שדות שרק מנהל רשאי לשנות.
 * בגרסה הנוכחית ילד אינו רשאי לעדכן אף שדה (ובוודאי לא isAvailable).
 * להרחבה עתידית יש להוסיף כאן שמות שדות — לעולם לא את isAvailable או childId.
 */
export const CHILD_EDITABLE_CLOTHING_FIELDS: readonly string[] = [];

export const ADMIN_EDITABLE_CLOTHING_FIELDS: readonly string[] = [
  "name",
  "category",
  "season",
  "imageUrl",
  "isAvailable",
];
