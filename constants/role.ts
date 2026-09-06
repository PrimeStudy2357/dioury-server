import { TimelineRole } from "@prisma/client";

/** ADMIN 이상(OWNER, ADMIN) 권한으로 간주하는 타임라인 역할 */
export const TIMELINE_ADMIN_ROLES: TimelineRole[] = [
  TimelineRole.OWNER,
  TimelineRole.ADMIN,
];
