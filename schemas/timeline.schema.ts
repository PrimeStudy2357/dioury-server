import z from "zod";
import { LIST_ORDER, LIST_SORT_BY } from "../constants/order";

export const timelineSchema = z.object({
  name: z
    .string()
    .min(1, { error: "제목은 최소 1자 이상이어야 합니다." })
    .max(64, { error: "제목은 64자를 초과할 수 없습니다." }),
  isPublic: z.boolean(),
  isOn: z.boolean(),
  category: z.string(),
  keywords: z.array(z.string().min(1).max(16)).min(1).max(3),
  description: z.string().min(1).max(256),
  period: z.string().optional(),
});

/** 타임라인 상세 조회 요청 파라미터 스키마 */
export const getTimelineParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** 타임라인 목록 조회 요청 스키마 */
export const getTimelineListSchema = z.object({
  /** 페이지 번호 */
  page: z.coerce.number().int().positive().default(1),
  /** 페이지당 아이템 수 */
  perPage: z.coerce.number().int().min(1).max(100).default(7),
  /** 정렬 기준 */
  sortBy: z.enum(Object.values(LIST_SORT_BY)).default(LIST_SORT_BY.CREATED_AT),
  /** 정렬 방향 */
  order: z.enum(Object.values(LIST_ORDER)).default(LIST_ORDER.DESCENDING),
});

