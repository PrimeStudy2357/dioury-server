import { TimelineRole } from "@prisma/client";

/** ADMIN 이상(OWNER, ADMIN) 권한으로 간주하는 타임라인 역할 */
export const TIMELINE_ADMIN_ROLES: TimelineRole[] = [
  TimelineRole.OWNER,
  TimelineRole.ADMIN,
];

/** 세션 작성이 가능한(FRIEND 이상) 타임라인 역할 */
export const TIMELINE_WRITER_ROLES: TimelineRole[] = [
  ...TIMELINE_ADMIN_ROLES,
  TimelineRole.FRIEND,
];
