export type Role = "admin" | "child";

export interface AuthContext {
  sessionId: string;
  role: Role;
  familyId: string;
  childId: string | null;
}
