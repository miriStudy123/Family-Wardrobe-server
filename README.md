# Family Wardrobe — צד השרת

שרת API למערכת ניהול ארון בגדים משפחתי, עם תיעוד Swagger מלא.

**טכנולוגיות:** Node.js · TypeScript · Express · PostgreSQL · Prisma ORM · Zod · Vitest · Swagger UI

> התיקייה `server/` עצמאית לחלוטין ואינה נוגעת בקוד הלקוח (React).

---

## 1. התקנה והפעלה

### דרישות מוקדמות
- Node.js 20 ומעלה
- PostgreSQL 14 ומעלה (או Docker)

### שלבים

```bash
cd server
npm install

# 1. קובץ סביבה
cp .env.example .env
#    יש להחליף את CODE_PEPPER במחרוזת אקראית:
#    node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# 2. מסד נתונים (אפשרות א — Docker; יוצר גם את wardrobe_test לבדיקות)
docker compose up -d
#    אפשרות ב — PostgreSQL קיים: ליצור מסדי נתונים wardrobe ו-wardrobe_test
#    ולעדכן את DATABASE_URL בהתאם

# 3. יצירת הטבלאות (בהרצה הראשונה נוצרת תיקיית prisma/migrations — יש לשמור אותה ב-Git)
npx prisma migrate dev --name init

# 4. הפעלה בפיתוח
npm run dev
```

- השרת: `http://localhost:4000`
- **Swagger UI:** `http://localhost:4000/api/docs`
- מסמך OpenAPI ב-JSON: `http://localhost:4000/api/docs.json`
- בדיקת חיות: `GET /health`

### הפעלה ב-Production

```bash
npm run build
npm run prisma:deploy   # מריץ migrations קיימים בלבד
npm start
```

### Migrations

| פעולה | פקודה |
|---|---|
| שינוי בסכמה בפיתוח | לערוך את `prisma/schema.prisma` ואז `npx prisma migrate dev --name <תיאור>` |
| החלה בסביבת Production | `npm run prisma:deploy` |
| צפייה בנתונים | `npm run prisma:studio` |

כל שינוי בסכמה מתועד כ-migration בתיקיית `prisma/migrations`.

---

## 2. הרצת בדיקות

הבדיקות רצות מול מסד נתונים ייעודי (`wardrobe_test`) ומנקות אותו לפני כל בדיקה.

```bash
cp .env.test.example .env.test
npm run test:db:prepare   # יצירת הטבלאות במסד הבדיקות
npm test
```

קבצי הבדיקות (`tests/`): `auth`, `children`, `clothing`, `selection`, `outfits`, `messages`, `security`, `categoryRules` — מכסים את כל התרחישים שבסעיף 20 באפיון, כולל אישורים מקבילים ואיפוס הבחירה בכניסה.

---

## 3. מבנה הפרויקט

```
server/
├── prisma/schema.prisma          מודל הנתונים, קשרים, אילוצים ואינדקסים
├── src/
│   ├── index.ts                  הפעלת השרת, ניקוי Sessions, כיבוי מסודר
│   ├── app.ts                    הרכבת Express: Swagger, helmet, CORS, נתיבים, שגיאות
│   ├── routes.ts                 חיבור כל המודולים תחת /api
│   ├── config/env.ts             טעינה ובדיקה של משתני סביבה
│   ├── docs/openapi.ts           מסמך OpenAPI (Swagger)
│   ├── domain/
│   │   ├── categoryRules.ts      כלל התצוגה לפי מגדר — מקום מרכזי אחד
│   │   └── permissions.ts        שדות פריט שילד/מנהל רשאים לעדכן
│   ├── lib/                      Prisma, הצפנה ו-hash, שגיאות, ולידציה משותפת
│   ├── middleware/               אימות והרשאות, הגבלת קצב, מטפל שגיאות
│   └── modules/
│       ├── auth/                 התחברות, התנתקות, חסימת ניסיונות, החלפת קוד
│       ├── families/             יצירת משפחה, משפחה נוכחית
│       ├── children/             ניהול ילדים ואיפוס קוד ילד
│       ├── clothing/             פריטי לבוש, סינון, זמינות
│       ├── selection/            בחירה נוכחית ואישור לבישה
│       ├── outfits/              Looks
│       └── messages/             הודעות
└── tests/                        בדיקות אוטומטיות (Vitest + Supertest)
```

כל מודול בנוי משלוש שכבות: `*.routes.ts` (נתיבים והרשאות), `*.schemas.ts` (ולידציה עם Zod) ו-`*.service.ts` (לוגיקה עסקית וגישה למסד).

---

## 4. מבנה מסד הנתונים

| טבלה | תפקיד | אילוצים עיקריים |
|---|---|---|
| `Family` | משפחה | `familyCode` ייחודי; קוד המנהל נשמר כ-bcrypt hash |
| `Child` | ילד | שייך למשפחה; שם ייחודי בתוך המשפחה; קוד הילד ייחודי בתוך המשפחה (נאכף דרך HMAC) ונשמר כ-bcrypt hash |
| `ClothingItem` | פריט לבוש | שייך לילד; `category` ו-`season` כ-enum; אינדקסים לפי `childId`, `isAvailable`, `category`, `season` |
| `CurrentSelection` | הבחירה הנוכחית | `childId` ייחודי — בחירה אחת לכל ילד |
| `CurrentSelectionItem` | פריט בבחירה | מפתח ראשי (בחירה, פריט) מונע כפילויות; מפתח זר מורכב `(clothingItemId, childId)` מבטיח שהפריט שייך לאותו ילד |
| `Outfit` | Look | שייך לילד |
| `OutfitItem` | פריט ב-Look | כמו `CurrentSelectionItem` — ללא כפילויות, ובאותו ילד בלבד |
| `Message` | הודעה | מפתח זר מורכב `(childId, familyId)` מבטיח שהשולח שייך למשפחה |
| `Session` | התחברות פעילה | נשמר SHA-256 של הטוקן בלבד; תאריך תפוגה |
| `LoginThrottle` | ניסיונות כושלים | מפתח HMAC; מונה וזמן חסימה |

**מדיניות מחיקה (Cascade, ללא קשרים יתומים):**
- מחיקת פריט לבוש ← מוסר מכל ה-Looks ומהבחירה הנוכחית. התשובה כוללת את רשימת ה-Looks שמהם הוסר ואם הוסר מהבחירה.
- מחיקת ילד ← נמחקים בגדיו, ה-Looks, הבחירה, ההודעות וה-Sessions שלו.
- מחיקת Look ← הבגדים עצמם אינם נמחקים.

---

## 5. התחברות והרשאות

### זרימת ההתחברות
1. **יצירת משפחה** — `POST /api/families` עם שם וקוד מנהל (8 תווים לפחות). המערכת מחזירה קוד משפחה ייחודי בן 8 תווים.
2. **כניסת מנהל** — שם משפחה + קוד משפחה + קוד מנהל. קוד המשפחה לבדו אינו מספיק.
3. **יצירת ילד** — המנהל יוצר ילד; המערכת מחזירה קוד אישי בן 6 תווים **פעם אחת בלבד**.
4. **כניסת ילד** — שם משפחה + קוד משפחה + שם הילד + קוד הילד.
5. כל כניסה מחזירה `token`; הלקוח שולח אותו בכל בקשה בכותרת `Authorization: Bearer <token>`.

### אבטחה
- קודי מנהל וילד נשמרים כ-bcrypt hash; טוקנים נשמרים כ-SHA-256 בלבד.
- תפקיד, משפחה וילד נקבעים **רק** לפי ה-Session בשרת — אף פעם לא לפי נתונים שהלקוח שולח.
- חסימה זמנית לפי זהות: אחרי 5 ניסיונות כושלים בתוך 15 דקות — חסימה ל-15 דקות (ניתן להגדרה).
- הגבלת קצב לפי IP על נקודות ההתחברות ויצירת משפחה.
- הודעת שגיאה אחידה בהתחברות, והשוואה מול hash מדומה כשהמשתמש לא קיים — לא נחשף אם משפחה או ילד קיימים.
- תפוגת Session (ברירת מחדל 8 שעות) והתנתקות.
- **איפוס קודים:** מנהל מחליף את קוד המנהל עם הקוד הנוכחי (`POST /api/auth/admin/change-code`), ויכול לייצר קוד חדש לילד (`POST /api/children/:id/reset-code`). בשני המקרים ה-Sessions הקודמים מבוטלים.
  שחזור קוד מנהל שנשכח ללא כל אמצעי אימות נוסף אינו אפשרי בגרסה זו, כי האפיון אינו כולל ערוץ אימות חיצוני (כמו דוא"ל).
- helmet, CORS מוגבל, הגבלת גודל גוף הבקשה, ולידציה קפדנית (שדות לא מוכרים נדחים), ללא Stack Traces בתשובות.

### טבלת הרשאות

| משאב | מנהל | ילד |
|---|---|---|
| משפחה נוכחית | ✓ (כולל קוד המשפחה) | ✓ (פרטיו בלבד) |
| ילדים — יצירה, רשימה, עדכון, מחיקה, איפוס קוד | ✓ | ✗ |
| ילד — צפייה | כל ילד במשפחה | רק עצמו |
| בגדים — צפייה וסינון | כל בגדי המשפחה | רק הבגדים שלו |
| בגדים — יצירה, עדכון, מחיקה, שינוי זמינות | ✓ | ✗ |
| בחירה נוכחית, אישור לבישה | ✗ | ✓ (שלו) |
| Looks | ✗ | ✓ (שלו) |
| הודעות — שליחה | ✗ | ✓ |
| הודעות — צפייה | כל הודעות המשפחה | ההודעות ששלח |
| הודעות — סימון כנקראה | ✓ | ✗ |

---

## 6. תהליך בחירת הבגדים

```
כניסת ילד ──► הבחירה מתאפסת לרשימה ריקה (בשרת, בטרנזקציה אחת עם יצירת ה-Session)
     │
     ▼
בחירת פריטים: POST /current-selection/items , DELETE /current-selection/items/:id , PUT /current-selection
     │        (אינה משנה זמינות; הבחירה נשמרת לאורך אותה התחברות)
     │
     ├──► "שמירת הלוק שלי": POST /outfits { name }  ← שומר את הבחירה המאומתת בשרת
     │
     ├──► פתיחת Look: POST /outfits/:id/apply  ← מחליף (לא ממזג) את הבחירה
     │
     ▼
אישור לבישה: POST /current-selection/confirm
     • בחירה ריקה                ← 400 EMPTY_SELECTION
     • פריט כלשהו אינו זמין      ← 409 ITEMS_UNAVAILABLE + details.unavailableItems, ושום דבר לא משתנה
     • כולם זמינים                ← כולם isAvailable=false, lastStatusChangeAt מתעדכן, הבחירה נשארת מוצגת
     │
     ▼
המנהל מחזיר בגדים לזמינות: PATCH /clothing/:id { isAvailable: true }
```

**הכלל המרכזי:** בכל כניסה חדשה ומוצלחת של ילד הבחירה הנוכחית מתאפסת. האיפוס אינו מוחק בגדים או Looks ואינו משנה זמינות, והוא מתבצע רק בכניסה — לא בכל בקשה.

**אטומיות האישור:** האישור רץ בטרנזקציה אחת. רשומת הבחירה ושורות הבגדים ננעלות (`SELECT … FOR UPDATE`, בסדר קבוע למניעת deadlock), כך ששתי בקשות מקבילות אינן יכולות לאשר את אותו פריט. בקשת אישור חוזרת מחזירה 409 ואינה משנה דבר.

**פריט שהפך ללא זמין אחרי שנבחר:** נשאר בבחירה, מסומן ב-`unavailableItems`, ו-`canConfirm` הוא `false` עד שהילד מסיר אותו.

---

## 7. סיכום נקודות הקצה

כל הנתיבים מתועדים במלואם ב-Swagger (`/api/docs`), כולל גופי בקשה, תשובות וקודי שגיאה.

| שיטה | נתיב | הרשאה |
|---|---|---|
| POST | `/api/families` | ציבורי |
| GET | `/api/families/current` | מחובר |
| POST | `/api/auth/admin/login` | ציבורי |
| POST | `/api/auth/child/login` | ציבורי |
| POST | `/api/auth/logout` | מחובר |
| POST | `/api/auth/admin/change-code` | מנהל |
| POST / GET | `/api/children` | מנהל |
| GET | `/api/children/:id` | מנהל / הילד עצמו |
| PATCH / DELETE | `/api/children/:id` | מנהל |
| POST | `/api/children/:id/reset-code` | מנהל |
| GET | `/api/clothing` | מנהל / ילד |
| POST | `/api/clothing` | מנהל |
| GET | `/api/clothing/:id` | מנהל / ילד (שלו) |
| PATCH | `/api/clothing/:id` | מנהל (ילד — 403) |
| DELETE | `/api/clothing/:id` | מנהל |
| GET / PUT | `/api/current-selection` | ילד |
| POST | `/api/current-selection/items` | ילד |
| DELETE | `/api/current-selection/items/:clothingItemId` | ילד |
| POST | `/api/current-selection/confirm` | ילד |
| POST / GET | `/api/outfits` | ילד |
| GET / PATCH / DELETE | `/api/outfits/:id` | ילד |
| POST | `/api/outfits/:id/apply` | ילד |
| POST | `/api/messages` | ילד |
| GET | `/api/messages` | מנהל / ילד |
| PATCH | `/api/messages/:id/read` | מנהל |

### סינון בגדים

`GET /api/clothing?childId=…&isAvailable=true&category=shirt&season=winter&search=כחול&sortBy=name&sortOrder=asc&page=1&limit=20`

- כל הפרמטרים אופציונליים וניתנים לשילוב; הסינון מתבצע במסד הנתונים.
- `sortBy` מוגבל ל: `name`, `category`, `season`, `isAvailable`, `lastStatusChangeAt`, `createdAt`, `updatedAt`.
- `limit` מקסימלי: 100. פרמטר לא מוכר ← 400.
- **כלל תצוגה לפי מגדר:** כשיש ילד יעד ולא נשלחה `category`, מוחזרות הקטגוריות המומלצות (boy: חולצות, מכנסיים, אביזרים; girl: כולן). `allCategories=true` מבטל זאת. הכלל מוגדר ב-`src/domain/categoryRules.ts`, אינו מגביל את הנתונים ואינו חלק מההרשאות.

### מבנה שגיאה אחיד

```json
{ "error": { "code": "ITEMS_UNAVAILABLE", "message": "חלק מהפריטים שנבחרו אינם זמינים כרגע",
             "details": { "unavailableItems": [{ "id": "…", "name": "מכנסיים" }] } } }
```

קודי HTTP: 400 בקשה לא תקינה · 401 לא מאומת · 403 אין הרשאה · 404 לא נמצא או לא נגיש · 409 התנגשות עסקית · 429 יותר מדי ניסיונות · 500 שגיאה פנימית.

---

## 8. חיבור מצד הלקוח (React)

```js
// התחברות
const res = await fetch('http://localhost:4000/api/auth/child/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ familyName, familyCode, childName, childCode }),
});
const { token } = await res.json();

// כל בקשה מאומתת
await fetch('http://localhost:4000/api/current-selection', {
  headers: { Authorization: `Bearer ${token}` },
});
```

יש להוסיף את כתובת הלקוח (למשל `http://localhost:5173`) למשתנה `CORS_ORIGIN`.

---

## 9. משתני סביבה

| משתנה | תיאור | ברירת מחדל |
|---|---|---|
| `DATABASE_URL` | כתובת PostgreSQL | — (חובה) |
| `CODE_PEPPER` | סוד שרת ל-HMAC (32 תווים לפחות) | — (חובה) |
| `PORT` | פורט השרת | 4000 |
| `CORS_ORIGIN` | כתובות לקוח מורשות, מופרדות בפסיק | `http://localhost:5173` |
| `TRUST_PROXY` | מספר proxies לפני השרת | 0 |
| `SESSION_TTL_MINUTES` | תוקף התחברות | 480 |
| `LOGIN_MAX_ATTEMPTS` | ניסיונות כושלים עד חסימה | 5 |
| `LOGIN_WINDOW_MINUTES` | חלון ספירת הניסיונות | 15 |
| `LOGIN_LOCK_MINUTES` | משך החסימה | 15 |
| `AUTH_RATE_LIMIT_MAX` | בקשות התחברות לכל IP ב-15 דקות | 50 |
| `BCRYPT_ROUNDS` | עלות ה-hash | 12 |

אין לשמור קובץ `.env` אמיתי במאגר הקוד (הוא מוחרג ב-`.gitignore`).
