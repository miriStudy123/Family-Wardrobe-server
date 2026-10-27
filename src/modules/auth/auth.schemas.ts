import { z } from 'zod';

const familyName = z.string().trim().min(1).max(100);
const code = z.string().trim().min(1).max(100);

export const adminLoginSchema = z
  .object({
    familyName,
    familyCode: code,
    adminCode: z.string().min(1).max(128),
  })
  .strict();

export const childLoginSchema = z
  .object({
    familyName,
    familyCode: code,
    childName: z.string().trim().min(1).max(60),
    childCode: code,
  })
  .strict();

export const changeAdminCodeSchema = z
  .object({
    currentAdminCode: z.string().min(1).max(128),
    newAdminCode: z.string().min(8, 'קוד מנהל חייב להכיל 8 תווים לפחות').max(128),
  })
  .strict()
  .refine((value) => value.currentAdminCode !== value.newAdminCode, {
    message: 'הקוד החדש חייב להיות שונה מהקוד הנוכחי',
    path: ['newAdminCode'],
  });

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type ChildLoginInput = z.infer<typeof childLoginSchema>;
export type ChangeAdminCodeInput = z.infer<typeof changeAdminCodeSchema>;
