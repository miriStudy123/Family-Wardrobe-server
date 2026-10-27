/**
 * מסמך OpenAPI 3.0 — מוצג ב-Swagger UI בכתובת /api/docs
 * ובפורמט JSON בכתובת /api/docs.json (לשימוש בצד הלקוח או ליצירת טיפוסים).
 */
import { CLOTHING_CATEGORIES, GENDERS, SEASONS } from '../domain/categoryRules';
import { CLOTHING_SORT_FIELDS } from '../modules/clothing/clothing.schemas';

type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });

const json = (schema: Schema) => ({ 'application/json': { schema } });

const ok = (description: string, schema: Schema) => ({ description, content: json(schema) });

const errorResponse = (description: string) => ({ description, content: json(ref('Error')) });

const E = {
  400: errorResponse('בקשה לא תקינה (VALIDATION_ERROR ועוד)'),
  401: errorResponse('לא מאומת / פרטי התחברות שגויים'),
  403: errorResponse('אין הרשאה לפעולה'),
  404: errorResponse('המשאב לא נמצא או אינו נגיש'),
  409: errorResponse('התנגשות עסקית'),
  429: errorResponse('יותר מדי ניסיונות'),
};

const secured = [{ bearerAuth: [] }];

const idParam = (name = 'id', description = 'מזהה') => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
});

const uuid = { type: 'string', format: 'uuid' };
const dateTime = { type: 'string', format: 'date-time' };

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Family Wardrobe API — מערכת לניהול ארון בגדים משפחתי',
    version: '1.0.0',
    description: [
      'API לניהול משפחות, ילדים, פריטי לבוש, בחירה נוכחית, Looks והודעות.',
      '',
      '**התחברות:** יש להתחבר דרך `/api/auth/admin/login` או `/api/auth/child/login`,',
      'ולהעביר את הטוקן שהתקבל בכותרת `Authorization: Bearer <token>` (כפתור Authorize).',
      '',
      '**כלל מרכזי:** בכל כניסה חדשה ומוצלחת של ילד הבחירה הנוכחית מתאפסת לרשימה ריקה.',
      'האיפוס אינו מוחק בגדים או Looks ואינו משנה זמינות.',
      '',
      '**מבנה שגיאה אחיד:** `{ "error": { "code", "message", "details?" } }`',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'השרת הנוכחי' }],
  tags: [
    { name: 'Families', description: 'יצירת משפחה ופרטי המשפחה הנוכחית' },
    { name: 'Auth', description: 'התחברות, התנתקות והחלפת קוד מנהל' },
    { name: 'Children', description: 'ניהול ילדים (מנהל)' },
    { name: 'Clothing', description: 'פריטי לבוש, זמינות וסינון' },
    { name: 'Current Selection', description: 'הבחירה הנוכחית של הילד המחובר ואישור לבישה' },
    { name: 'Outfits (Looks)', description: 'Looks שמורים של הילד המחובר' },
    { name: 'Messages', description: 'הודעות פרטיות מילד למנהל' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'טוקן שהתקבל בהתחברות' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'הבקשה אינה תקינה' },
              details: { description: 'מידע נוסף, למשל רשימת שדות שגויים או פריטים לא זמינים' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 3 },
        },
      },
      Gender: { type: 'string', enum: [...GENDERS] },
      Category: { type: 'string', enum: [...CLOTHING_CATEGORIES] },
      Season: { type: 'string', enum: [...SEASONS] },
      ItemRef: {
        type: 'object',
        properties: { id: uuid, name: { type: 'string' } },
      },
      Child: {
        type: 'object',
        properties: {
          id: uuid,
          name: { type: 'string', example: 'יוסי' },
          gender: ref('Gender'),
          recommendedCategories: { type: 'array', items: ref('Category') },
          createdAt: dateTime,
          updatedAt: dateTime,
        },
      },
      ClothingItem: {
        type: 'object',
        properties: {
          id: uuid,
          childId: uuid,
          name: { type: 'string', example: 'חולצה לבנה' },
          category: ref('Category'),
          season: ref('Season'),
          isAvailable: { type: 'boolean' },
          lastStatusChangeAt: dateTime,
          imageUrl: { type: 'string', nullable: true },
          createdAt: dateTime,
          updatedAt: dateTime,
        },
      },
      CurrentSelection: {
        type: 'object',
        properties: {
          id: uuid,
          childId: uuid,
          items: { type: 'array', items: ref('ClothingItem') },
          itemCount: { type: 'integer' },
          unavailableItems: {
            type: 'array',
            items: ref('ItemRef'),
            description: 'פריטים בבחירה שאינם זמינים כרגע — חוסמים אישור לבישה',
          },
          canConfirm: { type: 'boolean', description: 'true אם יש פריטים וכולם זמינים' },
          updatedAt: dateTime,
        },
      },
      Outfit: {
        type: 'object',
        properties: {
          id: uuid,
          name: { type: 'string', example: 'הלוק האהוב עליי' },
          items: { type: 'array', items: ref('ClothingItem') },
          itemCount: { type: 'integer' },
          unavailableItems: { type: 'array', items: ref('ItemRef') },
          createdAt: dateTime,
          updatedAt: dateTime,
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: uuid,
          childId: uuid,
          childName: { type: 'string' },
          body: { type: 'string' },
          createdAt: dateTime,
          readAt: { ...dateTime, nullable: true },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresAt: dateTime,
          role: { type: 'string', enum: ['admin', 'child'] },
          family: { type: 'object', properties: { id: uuid, name: { type: 'string' } } },
          child: ref('Child'),
        },
      },
    },
  },
  paths: {
    // ---------------- Families ----------------
    '/api/families': {
      post: {
        tags: ['Families'],
        summary: 'יצירת משפחה חדשה',
        description: 'המערכת מייצרת קוד משפחה ייחודי ומחזירה אותו. קוד המנהל נשמר כ-hash בלבד.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['name', 'adminCode'],
            properties: {
              name: { type: 'string', example: 'משפחת כהן' },
              adminCode: { type: 'string', minLength: 8, example: 'MySecret123' },
            },
          }),
        },
        responses: {
          201: ok('המשפחה נוצרה', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              family: {
                type: 'object',
                properties: {
                  id: uuid,
                  name: { type: 'string' },
                  familyCode: { type: 'string', example: 'K7M2QX9A' },
                  createdAt: dateTime,
                },
              },
            },
          }),
          400: E[400],
          429: E[429],
        },
      },
    },
    '/api/families/current': {
      get: {
        tags: ['Families'],
        summary: 'פרטי המשפחה של המשתמש המחובר',
        description: 'למנהל מוחזר גם קוד המשפחה; לילד מוחזרים גם פרטיו.',
        security: secured,
        responses: { 200: ok('פרטי המשפחה', { type: 'object' }), 401: E[401] },
      },
    },

    // ---------------- Auth ----------------
    '/api/auth/admin/login': {
      post: {
        tags: ['Auth'],
        summary: 'כניסת מנהל',
        description: 'דורש שם משפחה + קוד משפחה + קוד מנהל. קוד המשפחה לבדו אינו מספיק.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['familyName', 'familyCode', 'adminCode'],
            properties: {
              familyName: { type: 'string', example: 'משפחת כהן' },
              familyCode: { type: 'string', example: 'K7M2QX9A' },
              adminCode: { type: 'string', example: 'MySecret123' },
            },
          }),
        },
        responses: { 200: ok('התחברות הצליחה', ref('LoginResponse')), 400: E[400], 401: E[401], 429: E[429] },
      },
    },
    '/api/auth/child/login': {
      post: {
        tags: ['Auth'],
        summary: 'כניסת ילד',
        description: 'לאחר אימות מוצלח — הבחירה הנוכחית של הילד מתאפסת לרשימה ריקה (בצד השרת, באופן אטומי).',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['familyName', 'familyCode', 'childName', 'childCode'],
            properties: {
              familyName: { type: 'string', example: 'משפחת כהן' },
              familyCode: { type: 'string', example: 'K7M2QX9A' },
              childName: { type: 'string', example: 'יוסי' },
              childCode: { type: 'string', example: 'H4T9PZ' },
            },
          }),
        },
        responses: { 200: ok('התחברות הצליחה', ref('LoginResponse')), 400: E[400], 401: E[401], 429: E[429] },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'המשתמש המחובר (AuthMe)',
        description: 'מחזיר את המשתמש המחובר לפי הטוקן. name — שם הילד כשמחובר ילד, null כשמחובר מנהל.',
        security: secured,
        responses: {
          200: ok('המשתמש המחובר', {
            type: 'object',
            properties: {
              familyName: { type: 'string', example: 'משפחת כהן' },
              familyCode: { type: 'string', example: 'K7M2QX9A' },
              role: { type: 'string', enum: ['admin', 'child'] },
              name: { type: 'string', nullable: true, example: 'יוסי' },
            },
          }),
          401: E[401],
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'התנתקות (ביטול ה-Session הנוכחי)',
        security: secured,
        responses: { 204: { description: 'נותק' }, 401: E[401] },
      },
    },
    '/api/auth/admin/change-code': {
      post: {
        tags: ['Auth'],
        summary: 'החלפת קוד מנהל',
        description: 'דורש את הקוד הנוכחי. לאחר ההחלפה ה-Sessions האחרים של המנהל מבוטלים.',
        security: secured,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['currentAdminCode', 'newAdminCode'],
            properties: {
              currentAdminCode: { type: 'string' },
              newAdminCode: { type: 'string', minLength: 8 },
            },
          }),
        },
        responses: { 200: ok('הקוד עודכן', { type: 'object' }), 400: E[400], 401: E[401], 403: E[403], 429: E[429] },
      },
    },

    // ---------------- Children ----------------
    '/api/children': {
      post: {
        tags: ['Children'],
        summary: 'יצירת ילד (מנהל)',
        description: 'המערכת מייצרת קוד אישי לילד ומחזירה אותו פעם אחת בלבד.',
        security: secured,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['name', 'gender'],
            properties: { name: { type: 'string', example: 'יוסי' }, gender: ref('Gender') },
          }),
        },
        responses: {
          201: ok('הילד נוצר', {
            type: 'object',
            properties: { child: ref('Child'), childCode: { type: 'string', example: 'H4T9PZ' }, message: { type: 'string' } },
          }),
          400: E[400],
          401: E[401],
          403: E[403],
          409: E[409],
        },
      },
      get: {
        tags: ['Children'],
        summary: 'רשימת ילדי המשפחה (מנהל)',
        security: secured,
        responses: {
          200: ok('רשימה', { type: 'object', properties: { data: { type: 'array', items: ref('Child') } } }),
          401: E[401],
          403: E[403],
        },
      },
    },
    '/api/children/{id}': {
      parameters: [idParam('id', 'מזהה הילד')],
      get: {
        tags: ['Children'],
        summary: 'הצגת ילד (מנהל — כל ילד במשפחה; ילד — רק את עצמו)',
        security: secured,
        responses: { 200: ok('הילד', { type: 'object', properties: { child: ref('Child') } }), 401: E[401], 403: E[403], 404: E[404] },
      },
      patch: {
        tags: ['Children'],
        summary: 'עדכון פרטי ילד (מנהל)',
        description: 'שינוי מגדר משנה רק את קטגוריות התצוגה המומלצות ואינו מוחק בגדים.',
        security: secured,
        requestBody: {
          required: true,
          content: json({ type: 'object', properties: { name: { type: 'string' }, gender: ref('Gender') } }),
        },
        responses: { 200: ok('עודכן', { type: 'object', properties: { child: ref('Child') } }), 400: E[400], 403: E[403], 404: E[404], 409: E[409] },
      },
      delete: {
        tags: ['Children'],
        summary: 'מחיקת ילד (מנהל)',
        description: 'מדיניות מחיקה: נמחקים גם בגדי הילד, ה-Looks, הבחירה הנוכחית, ההודעות וה-Sessions שלו.',
        security: secured,
        responses: { 204: { description: 'נמחק' }, 403: E[403], 404: E[404] },
      },
    },
    '/api/children/{id}/reset-code': {
      parameters: [idParam('id', 'מזהה הילד')],
      post: {
        tags: ['Children'],
        summary: 'איפוס קוד ילד (מנהל)',
        description: 'מייצר קוד חדש (מוחזר פעם אחת) ומבטל את כל ה-Sessions הפעילים של הילד.',
        security: secured,
        responses: { 200: ok('קוד חדש', { type: 'object', properties: { childCode: { type: 'string' } } }), 403: E[403], 404: E[404] },
      },
    },

    // ---------------- Clothing ----------------
    '/api/clothing': {
      get: {
        tags: ['Clothing'],
        summary: 'רשימת בגדים עם סינון, חיפוש, מיון ודפדוף',
        description: [
          'ילד — רק הבגדים שלו (childId אחר יחזיר 403). מנהל — כל בגדי המשפחה או של ילד מסוים.',
          'אם נקבע ילד יעד ולא נשלחה category — מוחלות הקטגוריות המומלצות לפי מגדר (ניתן לבטל עם allCategories=true).',
        ].join('\n'),
        security: secured,
        parameters: [
          { name: 'childId', in: 'query', schema: uuid },
          { name: 'isAvailable', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'category', in: 'query', schema: ref('Category') },
          { name: 'season', in: 'query', schema: ref('Season') },
          { name: 'search', in: 'query', description: 'חיפוש בשם הפריט', schema: { type: 'string', maxLength: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: [...CLOTHING_SORT_FIELDS], default: 'createdAt' } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'allCategories', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
        ],
        responses: {
          200: ok('רשימה', {
            type: 'object',
            properties: {
              data: { type: 'array', items: ref('ClothingItem') },
              pagination: ref('Pagination'),
              meta: {
                type: 'object',
                properties: {
                  recommendedCategories: { type: 'array', items: ref('Category'), nullable: true },
                  defaultCategoryFilterApplied: { type: 'boolean' },
                },
              },
            },
          }),
          400: E[400],
          401: E[401],
          403: E[403],
          404: E[404],
        },
      },
      post: {
        tags: ['Clothing'],
        summary: 'יצירת פריט לבוש (מנהל)',
        security: secured,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['childId', 'name', 'category', 'season'],
            properties: {
              childId: uuid,
              name: { type: 'string', example: 'חולצה לבנה' },
              category: ref('Category'),
              season: ref('Season'),
              imageUrl: { type: 'string', nullable: true },
              isAvailable: { type: 'boolean', default: true },
            },
          }),
        },
        responses: { 201: ok('נוצר', { type: 'object', properties: { item: ref('ClothingItem') } }), 400: E[400], 403: E[403], 404: E[404] },
      },
    },
    '/api/clothing/{id}': {
      parameters: [idParam('id', 'מזהה הפריט')],
      get: {
        tags: ['Clothing'],
        summary: 'הצגת פריט',
        security: secured,
        responses: { 200: ok('הפריט', { type: 'object', properties: { item: ref('ClothingItem') } }), 401: E[401], 404: E[404] },
      },
      patch: {
        tags: ['Clothing'],
        summary: 'עדכון פריט',
        description: 'מנהל — name, category, season, imageUrl, isAvailable. ילד אינו רשאי לעדכן שדות (403), ובפרט לא את isAvailable. רק שינוי אמיתי בזמינות מעדכן את lastStatusChangeAt.',
        security: secured,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            properties: {
              name: { type: 'string' },
              category: ref('Category'),
              season: ref('Season'),
              imageUrl: { type: 'string', nullable: true },
              isAvailable: { type: 'boolean' },
            },
          }),
        },
        responses: { 200: ok('עודכן', { type: 'object', properties: { item: ref('ClothingItem') } }), 400: E[400], 403: E[403], 404: E[404] },
      },
      delete: {
        tags: ['Clothing'],
        summary: 'מחיקת פריט (מנהל)',
        description: 'הפריט מוסר אוטומטית מכל ה-Looks ומהבחירה הנוכחית. מוחזר סיכום ההסרות.',
        security: secured,
        responses: {
          200: ok('נמחק', {
            type: 'object',
            properties: {
              deleted: { type: 'boolean' },
              id: uuid,
              removedFromOutfitIds: { type: 'array', items: uuid },
              removedFromCurrentSelection: { type: 'boolean' },
            },
          }),
          403: E[403],
          404: E[404],
        },
      },
    },

    // ---------------- Current Selection ----------------
    '/api/current-selection': {
      get: {
        tags: ['Current Selection'],
        summary: 'הבחירה הנוכחית של הילד המחובר',
        security: secured,
        responses: { 200: ok('הבחירה', { type: 'object', properties: { selection: ref('CurrentSelection') } }), 401: E[401], 403: E[403] },
      },
      put: {
        tags: ['Current Selection'],
        summary: 'החלפת הבחירה ברשימת פריטים חדשה',
        security: secured,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['clothingItemIds'],
            properties: { clothingItemIds: { type: 'array', items: uuid, maxItems: 50 } },
          }),
        },
        responses: { 200: ok('הבחירה', { type: 'object', properties: { selection: ref('CurrentSelection') } }), 400: E[400], 404: E[404] },
      },
    },
    '/api/current-selection/items': {
      post: {
        tags: ['Current Selection'],
        summary: 'הוספת פריט לבחירה',
        description: 'אינה משנה זמינות. הוספה חוזרת של אותו פריט אינה יוצרת כפילות.',
        security: secured,
        requestBody: {
          required: true,
          content: json({ type: 'object', required: ['clothingItemId'], properties: { clothingItemId: uuid } }),
        },
        responses: { 200: ok('הבחירה', { type: 'object', properties: { selection: ref('CurrentSelection') } }), 400: E[400], 404: E[404] },
      },
    },
    '/api/current-selection/items/{clothingItemId}': {
      parameters: [idParam('clothingItemId', 'מזהה הפריט')],
      delete: {
        tags: ['Current Selection'],
        summary: 'הסרת פריט מהבחירה',
        security: secured,
        responses: { 200: ok('הבחירה', { type: 'object', properties: { selection: ref('CurrentSelection') } }), 404: E[404] },
      },
    },
    '/api/current-selection/confirm': {
      post: {
        tags: ['Current Selection'],
        summary: 'אישור לבישה',
        description: [
          'אטומי: אם כל הפריטים זמינים — כולם מסומנים isAvailable=false ו-lastStatusChangeAt מתעדכן.',
          'אם פריט כלשהו אינו זמין — 409 עם details.unavailableItems ושום פריט אינו משתנה.',
          'הבחירה נשארת שמורה עד הכניסה הבאה.',
        ].join('\n'),
        security: secured,
        responses: {
          200: ok('אושר', {
            type: 'object',
            properties: {
              confirmed: { type: 'boolean' },
              confirmedAt: dateTime,
              message: { type: 'string' },
              selection: ref('CurrentSelection'),
            },
          }),
          400: errorResponse('EMPTY_SELECTION — הבחירה ריקה'),
          409: errorResponse('ITEMS_UNAVAILABLE — details.unavailableItems'),
        },
      },
    },

    // ---------------- Outfits ----------------
    '/api/outfits': {
      post: {
        tags: ['Outfits (Looks)'],
        summary: 'יצירת Look ("שמירת הלוק שלי")',
        description: 'ללא clothingItemIds — נשמרת הבחירה הנוכחית כפי שהיא שמורה בשרת (מומלץ). Look ריק נדחה (400 EMPTY_OUTFIT).',
        security: secured,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', example: 'הלוק האהוב עליי' },
              clothingItemIds: { type: 'array', items: uuid, minItems: 1, maxItems: 50 },
            },
          }),
        },
        responses: { 201: ok('נוצר', { type: 'object', properties: { outfit: ref('Outfit') } }), 400: E[400], 404: E[404] },
      },
      get: {
        tags: ['Outfits (Looks)'],
        summary: 'כל ה-Looks של הילד המחובר',
        security: secured,
        responses: { 200: ok('רשימה', { type: 'object', properties: { data: { type: 'array', items: ref('Outfit') } } }) },
      },
    },
    '/api/outfits/{id}': {
      parameters: [idParam('id', 'מזהה ה-Look')],
      get: {
        tags: ['Outfits (Looks)'],
        summary: 'הצגת Look',
        security: secured,
        responses: { 200: ok('ה-Look', { type: 'object', properties: { outfit: ref('Outfit') } }), 404: E[404] },
      },
      patch: {
        tags: ['Outfits (Looks)'],
        summary: 'עדכון שם או פריטים',
        description: 'clothingItemIds מחליף את כל הפריטים; addItemIds/removeItemIds מוסיפים/מסירים. אינו משנה זמינות או את הבחירה הנוכחית.',
        security: secured,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            properties: {
              name: { type: 'string' },
              clothingItemIds: { type: 'array', items: uuid },
              addItemIds: { type: 'array', items: uuid },
              removeItemIds: { type: 'array', items: uuid },
            },
          }),
        },
        responses: { 200: ok('עודכן', { type: 'object', properties: { outfit: ref('Outfit') } }), 400: E[400], 404: E[404] },
      },
      delete: {
        tags: ['Outfits (Looks)'],
        summary: 'מחיקת Look',
        security: secured,
        responses: { 204: { description: 'נמחק' }, 404: E[404] },
      },
    },
    '/api/outfits/{id}/apply': {
      parameters: [idParam('id', 'מזהה ה-Look')],
      post: {
        tags: ['Outfits (Looks)'],
        summary: 'פתיחת Look — החלפת הבחירה הנוכחית בפריטי ה-Look',
        description: 'מחליף (לא ממזג) את הבחירה הנוכחית. אינו משנה זמינות; מוחזר מצב הזמינות העדכני.',
        security: secured,
        responses: {
          200: ok('הבחירה החדשה', {
            type: 'object',
            properties: { appliedOutfitId: uuid, selection: ref('CurrentSelection') },
          }),
          404: E[404],
        },
      },
    },

    // ---------------- Messages ----------------
    '/api/messages': {
      post: {
        tags: ['Messages'],
        summary: 'שליחת הודעה למנהל המשפחה (ילד)',
        security: secured,
        requestBody: {
          required: true,
          content: json({ type: 'object', required: ['body'], properties: { body: { type: 'string', maxLength: 2000 } } }),
        },
        responses: { 201: ok('נשלחה', { type: 'object', properties: { message: ref('Message') } }), 400: E[400], 403: E[403] },
      },
      get: {
        tags: ['Messages'],
        summary: 'הודעות שהמשתמש רשאי לראות',
        description: 'מנהל — כל הודעות המשפחה; ילד — ההודעות ששלח.',
        security: secured,
        parameters: [
          { name: 'unreadOnly', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'childId', in: 'query', schema: uuid },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          200: ok('רשימה', {
            type: 'object',
            properties: { data: { type: 'array', items: ref('Message') }, pagination: ref('Pagination') },
          }),
          400: E[400],
          403: E[403],
        },
      },
    },
    '/api/messages/{id}/read': {
      parameters: [idParam('id', 'מזהה ההודעה')],
      patch: {
        tags: ['Messages'],
        summary: 'סימון הודעה כנקראה (מנהל)',
        security: secured,
        responses: { 200: ok('עודכן', { type: 'object', properties: { message: ref('Message') } }), 403: E[403], 404: E[404] },
      },
    },
  },
};
