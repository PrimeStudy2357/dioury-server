import { Request, Response } from "express";
import { Prisma, TimelineRole } from "@prisma/client";
import z from "zod";
import { TIMELINE_ADMIN_ROLES } from "../constants/role";
import {
  createSessionSchema,
  getSessionListSchema,
  getSessionParamsSchema,
} from "../schemas/session.schema";
import prismaService from "../services/connectors/prisma.service";
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
 * 세션 상세 조회 컨트롤러
 */
export const getSessionController = async (req: Request, res: Response) => {
  try {
    const { id } = getSessionParamsSchema.parse(req.params);

    const session = await prismaService.session.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!session) {
      return res
        .status(404)
        .json({ message: "세션을 찾을 수 없습니다." } as ErrorResponse);
    }

    // 비공개 세션은 타임라인 멤버만 조회 가능
    if (!session.isPublic) {
      const userId = req.session.userId;

      if (!userId) {
        return res
          .status(401)
          .json({ message: "로그인이 필요합니다." } as ErrorResponse);
      }

      const member = await prismaService.timelineMember.findUnique({
        where: {
          userId_timelineId: { userId, timelineId: session.timelineId },
        },
      });

      if (!member) {
        return res
          .status(403)
          .json({ message: "권한이 없습니다." } as ErrorResponse);
      }
    }

    return res.status(200).json({
      success: true,
      data: session,
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

