import { Request, Response } from "express";
import { Prisma, TimelineRole } from "@prisma/client";
import z from "zod";
import { TIMELINE_ADMIN_ROLES } from "../constants/role";
import {
  createSessionSchema,
  getSessionListSchema,
  getSessionParamsSchema,
  toggleReactionSchema,
  createCommentSchema,
  deleteCommentParamsSchema,
} from "../schemas/session.schema";
import prismaService from "../services/connectors/prisma.service";
import redisService from "../services/connectors/redis.service";
import { ErrorResponse } from "../types/response";

/**
 * 세션 생성 컨트롤러
 */
export const createSessionController = async (req: Request, res: Response) => {
  try {
    const validatedData = createSessionSchema.parse(req.body);
    const {
      timelineId,
      title,
      place,
      date,
      content,
      isPublic,
      participantIds,
    } = validatedData;

    const { userId, nickname: writerNickname } = req.session;

    if (!userId || !writerNickname) {
      return res
        .status(401)
        .json({ message: "로그인이 필요합니다." } as ErrorResponse);
    }

    // 작성자는 항상 참여자로 포함되므로 중복 선택은 제외
    const otherParticipantIds = Array.from(new Set(participantIds)).filter(
      (id) => id !== userId,
    );

    const newSession = await prismaService.$transaction(async (tx) => {
      const members = await tx.timelineMember.findMany({
        where: {
          timelineId,
          userId: { in: [userId, ...otherParticipantIds] },
        },
        select: { userId: true, role: true },
      });
      const roleByUserId = new Map(members.map((m) => [m.userId, m.role]));

      const session = await tx.session.create({
        data: {
          timelineId,
          title,
          place,
          date,
          content,
          isPublic,
          writerId: userId,
          writerNickname,
          participantCnt: 1 + otherParticipantIds.length,
        },
      });

      await tx.sessionParticipant.createMany({
        data: [
          {
            sessionId: session.id,
            userId,
            timelineId,
            isWriter: true,
            // 작성자는 역할과 무관하게 항상 수정 가능
            canEdit: true,
          },
          ...otherParticipantIds.map((participantId) => ({
            sessionId: session.id,
            userId: participantId,
            timelineId,
            canEdit: TIMELINE_ADMIN_ROLES.includes(
              roleByUserId.get(participantId) as TimelineRole,
            ),
          })),
        ],
      });

      return session;
    });

    return res.status(201).json({ success: true, data: newSession });
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "잘못된 요청입니다.",
      } as ErrorResponse);
    }

    // 존재하지 않는 타임라인이거나, 작성자/참여자 중 타임라인 멤버가 아닌 사용자가 있는 경우
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return res.status(400).json({
        message:
          "존재하지 않는 타임라인이거나 참여자 중 타임라인 멤버가 아닌 사용자가 있습니다.",
      } as ErrorResponse);
    }

    return res
      .status(500)
      .json({ message: "Internal Server Error" } as ErrorResponse);
  }
};

/**
 * 세션 목록 조회 컨트롤러 (타임라인별)
 */
export const getSessionListController = async (req: Request, res: Response) => {
  try {
    const validatedData = getSessionListSchema.parse(req.query);
    const { timelineId, order, perPage, page, sortBy } = validatedData;
    const userId = req.session.userId!;

    // 타임라인 진입과 같은 조건: 공개 타임라인이거나 멤버여야 조회 가능
    const [timeline, member] = await Promise.all([
      prismaService.timeline.findUnique({ where: { id: timelineId } }),
      prismaService.timelineMember.findUnique({
        where: { userId_timelineId: { userId, timelineId } },
      }),
    ]);

    if (!timeline) {
      return res
        .status(404)
        .json({ message: "타임라인을 찾을 수 없습니다." } as ErrorResponse);
    }

    if (!timeline.isPublic && !member) {
      return res
        .status(403)
        .json({ message: "권한이 없습니다." } as ErrorResponse);
    }

    /** 페이징 계산 */
    const skip = (page - 1) * perPage;
    const where = { timelineId };

    const [totalCount, sessions] = await Promise.all([
      prismaService.session.count({ where }),
      prismaService.session.findMany({
        where,
        skip,
        take: perPage,
        orderBy: {
          [sortBy]: order,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: sessions,
      pagination: {
        page,
        perPage,
        totalCount,
        totalPages: Math.ceil(totalCount / perPage),
        hasNextPage: page * perPage < totalCount,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "잘못된 요청 파라미터입니다.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
};

/**
 * 세션 조회 권한 확인: 비멤버는 공개 타임라인의 공개 세션만 조회 가능
 */
const canAccessSession = async (
  session: {
    timelineId: number;
    isPublic: boolean;
    timeline: { isPublic: boolean };
  },
  userId: number,
) => {
  if (session.timeline.isPublic && session.isPublic) {
    return true;
  }

  const member = await prismaService.timelineMember.findUnique({
    where: { userId_timelineId: { userId, timelineId: session.timelineId } },
  });

  return !!member;
};

// 같은 사용자의 연속 새로고침으로 조회수가 오르지 않도록 하는 쿨다운
const SESSION_VIEW_COOLDOWN_SEC = 60;
const REDIS_SESSION_VIEW_KEY_PREFIX = "dioury-sessionView-";

/**
 * 세션 상세 조회 컨트롤러
 */
export const getSessionController = async (req: Request, res: Response) => {
  try {
    const { id } = getSessionParamsSchema.parse(req.params);

    const session = await prismaService.session.findUnique({
      where: { id },
      include: {
        participants: true,
        timeline: { select: { isPublic: true } },
      },
    });

    if (!session) {
      return res
        .status(404)
        .json({ message: "세션을 찾을 수 없습니다." } as ErrorResponse);
    }

    if (!(await canAccessSession(session, req.session.userId!))) {
      return res
        .status(403)
        .json({ message: "권한이 없습니다." } as ErrorResponse);
    }

    const { timeline, ...data } = session;

    try {
      const counted = await redisService.set(
        `${REDIS_SESSION_VIEW_KEY_PREFIX}${id}-${req.session.userId}`,
        1,
        {
          expiration: { type: "EX", value: SESSION_VIEW_COOLDOWN_SEC },
          condition: "NX",
        },
      );

      if (counted) {
        ({ viewCnt: data.viewCnt } = await prismaService.session.update({
          where: { id },
          data: { viewCnt: { increment: 1 } },
          select: { viewCnt: true },
        }));
      }
    } catch (error) {
      // 조회수 증가 실패로 상세 조회까지 막지 않는다
      console.error("조회수 증가 실패: ", error);
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "잘못된 요청 파라미터입니다.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
};

/**
 * 세션의 이모지별 반응 수, 반응한 사용자, 요청자 반응 여부 (먼저 달린 이모지·먼저 반응한 사용자 순)
 */
// ponytail: 반응한 사용자를 전부 내려준다. 세션당 반응이 수백 개를 넘으면 이모지별 사용자 목록 API로 분리
const getReactionSummary = async (sessionId: number, userId: number) => {
  const reactions = await prismaService.reaction.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      emoji: true,
      user: { select: { id: true, nickname: true } },
    },
  });

  const byEmoji = new Map<string, { id: number; nickname: string }[]>();
  for (const { emoji, user } of reactions) {
    byEmoji.set(emoji, [...(byEmoji.get(emoji) ?? []), user]);
  }

  return [...byEmoji].map(([emoji, users]) => ({
    emoji,
    count: users.length,
    reacted: users.some((u) => u.id === userId),
    users,
  }));
};

/**
 * 반응·댓글 API 공통: 세션이 없으면 404, 조회 권한이 없으면 403 응답 후 false 반환
 */
const checkSessionAccess = async (
  res: Response,
  sessionId: number,
  userId: number,
) => {
  const session = await prismaService.session.findUnique({
    where: { id: sessionId },
    include: { timeline: { select: { isPublic: true } } },
  });

  if (!session) {
    res
      .status(404)
      .json({ message: "세션을 찾을 수 없습니다." } as ErrorResponse);
    return false;
  }

  if (!(await canAccessSession(session, userId))) {
    res.status(403).json({ message: "권한이 없습니다." } as ErrorResponse);
    return false;
  }

  return true;
};

/**
 * 세션 반응 목록 조회 컨트롤러
 */
export const getReactionsController = async (req: Request, res: Response) => {
  try {
    const { id } = getSessionParamsSchema.parse(req.params);
    const userId = req.session.userId!;

    if (!(await checkSessionAccess(res, id, userId))) {
      return;
    }

    return res.status(200).json({
      success: true,
      data: await getReactionSummary(id, userId),
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "잘못된 요청 파라미터입니다.",
      } as ErrorResponse);
    }

    return res
      .status(500)
      .json({ message: "서버 오류가 발생했습니다." } as ErrorResponse);
  }
};

/**
 * 세션 반응 토글 컨트롤러: 이미 남긴 이모지면 취소, 아니면 추가
 */
export const toggleReactionController = async (req: Request, res: Response) => {
  try {
    const { id } = getSessionParamsSchema.parse(req.params);
    const { emoji } = toggleReactionSchema.parse(req.body);
    const userId = req.session.userId!;

    if (!(await checkSessionAccess(res, id, userId))) {
      return;
    }

    await prismaService.$transaction(async (tx) => {
      const { count } = await tx.reaction.deleteMany({
        where: { sessionId: id, userId, emoji },
      });

      if (!count) {
        await tx.reaction.create({ data: { sessionId: id, userId, emoji } });
      }

      await tx.session.update({
        where: { id },
        data: { reactionCnt: count ? { decrement: 1 } : { increment: 1 } },
      });
    });

    return res.status(200).json({
      success: true,
      data: await getReactionSummary(id, userId),
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: error.issues[0]?.message ?? "잘못된 요청입니다.",
      } as ErrorResponse);
    }

    // 같은 이모지 요청이 동시에 들어와 둘 다 추가하려 한 경우
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res
        .status(409)
        .json({ message: "이미 처리 중인 반응입니다." } as ErrorResponse);
    }

    return res
      .status(500)
      .json({ message: "서버 오류가 발생했습니다." } as ErrorResponse);
  }
};

/**
 * 댓글을 전부 내려준다. 최상위 댓글마다 답글을 replies로 묶어 작성 순으로 정렬.
 * 세션당 댓글이 수백 개를 넘으면 페이지네이션 추가
 */
const getComments = async (sessionId: number, userId: number) => {
  const comments = await prismaService.comment.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      parentId: true,
      deletedAt: true,
      user: { select: { id: true, nickname: true } },
    },
  });

  const toView = (c: (typeof comments)[number]) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    user: c.user,
    isMine: c.user.id === userId,
  });

  const repliesByParent = new Map<number, ReturnType<typeof toView>[]>();
  for (const c of comments) {
    if (c.parentId === null) continue;
    const replies = repliesByParent.get(c.parentId) ?? [];
    replies.push(toView(c));
    repliesByParent.set(c.parentId, replies);
  }

  return comments
    .filter((c) => c.parentId === null)
    .map((c) => {
      const replies = repliesByParent.get(c.id) ?? [];

      // soft delete된 댓글은 작성자·내용을 숨기고 자리만 남긴다
      return c.deletedAt
        ? {
            id: c.id,
            content: null,
            createdAt: c.createdAt,
            user: null,
            isMine: false,
            isDeleted: true,
            replies,
          }
        : { ...toView(c), isDeleted: false, replies };
    });
};

/**
 * 세션 댓글 목록 조회 컨트롤러 (작성 순)
 */
export const getCommentsController = async (req: Request, res: Response) => {
  try {
    const { id } = getSessionParamsSchema.parse(req.params);
    const userId = req.session.userId!;

    if (!(await checkSessionAccess(res, id, userId))) {
      return;
    }

    return res.status(200).json({
      success: true,
      data: await getComments(id, userId),
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "잘못된 요청 파라미터입니다.",
      } as ErrorResponse);
    }

    return res
      .status(500)
      .json({ message: "서버 오류가 발생했습니다." } as ErrorResponse);
  }
};

/**
 * 세션 댓글 작성 컨트롤러. 갱신된 댓글 목록을 반환
 */
export const createCommentController = async (req: Request, res: Response) => {
  try {
    const { id } = getSessionParamsSchema.parse(req.params);
    const { content, parentId } = createCommentSchema.parse(req.body);
    const userId = req.session.userId!;

    if (!(await checkSessionAccess(res, id, userId))) {
      return;
    }

    const created = await prismaService.$transaction(async (tx) => {
      if (parentId !== undefined) {
        // 같은 세션의 삭제되지 않은 최상위 댓글에만 답글 허용 (답글의 답글 불가)
        const parent = await tx.comment.findFirst({
          where: {
            id: parentId,
            sessionId: id,
            parentId: null,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!parent) {
          return false;
        }
      }

      await tx.comment.create({
        data: { sessionId: id, userId, content, parentId },
      });
      await tx.session.update({
        where: { id },
        data: { commentCnt: { increment: 1 } },
      });

      return true;
    });

    if (!created) {
      return res
        .status(400)
        .json({ message: "답글을 달 댓글을 찾을 수 없습니다." } as ErrorResponse);
    }

    return res.status(201).json({
      success: true,
      data: await getComments(id, userId),
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: error.issues[0]?.message ?? "잘못된 요청입니다.",
      } as ErrorResponse);
    }

    // 확인 직후 부모 댓글이 삭제된 경우 (FK 위반)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return res
        .status(400)
        .json({ message: "답글을 달 댓글을 찾을 수 없습니다." } as ErrorResponse);
    }

    return res
      .status(500)
      .json({ message: "서버 오류가 발생했습니다." } as ErrorResponse);
  }
};

/**
 * 세션 댓글 삭제 컨트롤러 (작성자 본인만). 갱신된 댓글 목록을 반환
 * - 답글이 달린 최상위 댓글: soft delete ("삭제된 댓글"로 표시)
 * - 그 외 댓글·답글: hard delete
 * - soft delete된 부모의 마지막 답글을 지우면 부모도 hard delete
 * commentCnt는 사용자가 지운 시점에 1 감소 (부모가 따라 지워질 때는 이미 차감됨)
 */
export const deleteCommentController = async (req: Request, res: Response) => {
  try {
    const { id, commentId } = deleteCommentParamsSchema.parse(req.params);
    const userId = req.session.userId!;

    if (!(await checkSessionAccess(res, id, userId))) {
      return;
    }

    const deleted = await prismaService.$transaction(async (tx) => {
      // 남의 댓글·다른 세션의 댓글·이미 삭제된 댓글은 찾지 않는다
      const target = await tx.comment.findFirst({
        where: { id: commentId, sessionId: id, userId, deletedAt: null },
        select: { parentId: true, _count: { select: { replies: true } } },
      });

      if (!target) {
        return false;
      }

      let count: number;
      if (target.parentId === null && target._count.replies > 0) {
        // 동시에 같은 댓글을 지우는 요청이 있어도 한 번만 차감되도록 count로 판별
        ({ count } = await tx.comment.updateMany({
          where: { id: commentId, deletedAt: null },
          data: { deletedAt: new Date() },
        }));
      } else {
        ({ count } = await tx.comment.deleteMany({ where: { id: commentId } }));

        if (count && target.parentId !== null) {
          await tx.comment.deleteMany({
            where: {
              id: target.parentId,
              deletedAt: { not: null },
              replies: { none: {} },
            },
          });
        }
      }

      if (count) {
        await tx.session.update({
          where: { id },
          data: { commentCnt: { decrement: 1 } },
        });
      }

      return count > 0;
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ message: "삭제할 댓글을 찾을 수 없습니다." } as ErrorResponse);
    }

    return res.status(200).json({
      success: true,
      data: await getComments(id, userId),
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "잘못된 요청 파라미터입니다.",
      } as ErrorResponse);
    }

    // 답글이 없는 걸 확인한 직후 답글이 달려 hard delete가 막힌 경우 (FK 위반)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return res.status(409).json({
        message: "방금 답글이 달렸습니다. 다시 시도해주세요.",
      } as ErrorResponse);
    }

    return res
      .status(500)
      .json({ message: "서버 오류가 발생했습니다." } as ErrorResponse);
  }
};

