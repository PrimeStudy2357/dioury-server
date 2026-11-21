import z from "zod";
import { LIST_ORDER, SESSION_LIST_SORT_BY } from "../constants/order";

/** 세션 생성 요청 스키마 */
export const createSessionSchema = z.object({
  timelineId: z.coerce.number().int().positive(),
  title: z
    .string()
    .min(1, { error: "제목은 최소 1자 이상이어야 합니다." })
    .max(64, { error: "제목은 64자를 초과할 수 없습니다." }),
  place: z.string().min(1, { error: "장소를 입력해주세요." }).max(128),
  date: z.coerce.date(),
  content: z.string().min(1, { error: "내용을 입력해주세요." }),
  isPublic: z.boolean(),
  /** 작성자 외 함께 등록할 참여자 목록 (userId) */
  participantIds: z
    .array(z.coerce.number().int().positive())
    .max(100, { error: "참여자는 최대 100명까지 등록할 수 있습니다." })
    .default([]),
});

/** 세션 상세 조회 요청 파라미터 스키마 */
export const getSessionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** 세션 목록 조회 요청 스키마 */
export const getSessionListSchema = z.object({
  /** 조회할 타임라인 id */
  timelineId: z.coerce.number().int().positive(),
  /** 페이지 번호 */
  page: z.coerce.number().int().positive().default(1),
  /** 페이지당 아이템 수 */
  perPage: z.coerce.number().int().min(1).max(100).default(7),
  /** 정렬 기준 */
  sortBy: z
    .enum(Object.values(SESSION_LIST_SORT_BY))
    .default(SESSION_LIST_SORT_BY.CREATED_AT),
  /** 정렬 방향 */
  order: z.enum(Object.values(LIST_ORDER)).default(LIST_ORDER.DESCENDING),
});

// 이모지 1개(피부색·ZWJ 조합·국기·키캡 포함). target(es2016)이 \p{}를 지원하지 않아 RegExp 생성자로 만든다
const EMOJI_REGEX = new RegExp(
  "^(?:\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier}|[\\u{E0020}-\\u{E007F}])*(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})*)*)$",
  "u",
);

/** 세션 반응 토글 요청 스키마 */
export const toggleReactionSchema = z.object({
  emoji: z
    .string()
    .max(32)
    .regex(EMOJI_REGEX, { error: "이모지 1개만 입력할 수 있습니다." }),
});

/** 세션 댓글 작성 요청 스키마 */
export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { error: "댓글 내용을 입력해주세요." })
    .max(1000, { error: "댓글은 1000자를 초과할 수 없습니다." }),
  /** 답글이면 답글을 달 최상위 댓글 id */
  parentId: z.number().int().positive().optional(),
});

/** 세션 댓글 삭제 요청 파라미터 스키마 */
export const deleteCommentParamsSchema = getSessionParamsSchema.extend({
  commentId: z.coerce.number().int().positive(),
});
