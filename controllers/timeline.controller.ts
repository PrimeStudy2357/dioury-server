import { Request, Response } from "express";
import {
  getTimelineListSchema,
  getTimelineMembersParamsSchema,
  getTimelineMembersQuerySchema,
  getTimelineParamsSchema,
  timelineSchema,
} from "../schemas/timeline.schema";
import prismaService from "../services/connectors/prisma.service";
import { ErrorResponse } from "../types/response";
import z from "zod";

export const createTimelineController = async (req: Request, res: Response) => {
  try {
    const validatedData = timelineSchema.parse(req.body);
    const {
      description,
      isOn,
      isPublic,
      keywords,
      name,
      period = "",
      category,
    } = validatedData;
    const [keyword1, keyword2, keyword3] = keywords;

    const userNickname = req.session.nickname;
    const userId = req.session.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "로그인이 필요합니다." } as ErrorResponse);
    }

    const newTimeline = await prismaService.$transaction(async (tx) => {
      const timeline = await tx.timeline.create({
        data: {
          name,
          description,
          isOn,
          isPublic,
          keyword1,
          keyword2,
          keyword3,
          category,
          period,
          creator: {
            connect: { nickname: userNickname },
          },
        },
      });

      await tx.timelineMember.create({
        data: {
          userId,
          timelineId: timeline.id,
          role: "OWNER",
        },
      });

      return timeline;
    });

    return res.status(201).json(newTimeline);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error" } as ErrorResponse);
  }
};

/**
 * 가입한 타임라인 목록 조회 컨트롤러
 */
export const getJoinedTimelinesController = async (
  req: Request,
  res: Response,
) => {
  return res.status(501).json({ message: "구현 중" });
};

/**
 * 전체(추천) 타임라인 목록 조회 컨트롤러
 */
export const getRecommendedTimelinesController = async (
  req: Request,
  res: Response,
) => {
  try {
    const validatedData = getTimelineListSchema.parse(req.query);
    const { order, perPage, page, sortBy } = validatedData;

    /** 페이징 계산 */
    const skip = (page - 1) * perPage;

    const [totalCount, timelines] = await Promise.all([
      prismaService.timeline.count({}),
      prismaService.timeline.findMany({
        skip: skip,
        take: perPage,
        orderBy: {
          [sortBy]: order,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: timelines,
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
    // Zod 에러 처리
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "잘못된 요청 파라미터입니다.",
      });
    }

    // 일반 서버 에러 처리
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
};

/**
 * 타임라인 상세 조회 컨트롤러
 */
export const getTimelineController = async (req: Request, res: Response) => {
  try {
    const { id } = getTimelineParamsSchema.parse(req.params);

    const timeline = await prismaService.timeline.findUnique({
      where: { id },
    });

    if (!timeline) {
      return res
        .status(404)
        .json({ message: "타임라인을 찾을 수 없습니다." } as ErrorResponse);
    }

    return res.status(200).json({
      success: true,
      data: timeline,
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
 * 타임라인 멤버 검색/목록 조회 컨트롤러
 * 세션 참여자 선택 등에서 사용하며, 요청자도 해당 타임라인의 멤버여야 조회할 수 있다.
 */
export const getTimelineMembersController = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id: timelineId } = getTimelineMembersParamsSchema.parse(req.params);
    const { query, page, perPage } = getTimelineMembersQuerySchema.parse(
      req.query,
    );

    const userId = req.session.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "로그인이 필요합니다." } as ErrorResponse);
    }

    const requester = await prismaService.timelineMember.findUnique({
      where: { userId_timelineId: { userId, timelineId } },
    });

    if (!requester) {
      return res
        .status(403)
        .json({ message: "권한이 없습니다." } as ErrorResponse);
    }

    const where = {
      timelineId,
      ...(query && { user: { nickname: { contains: query } } }),
    };

    const skip = (page - 1) * perPage;

    const [totalCount, members] = await Promise.all([
      prismaService.timelineMember.count({ where }),
      prismaService.timelineMember.findMany({
        where,
        skip,
        take: perPage,
        select: {
          userId: true,
          role: true,
          user: { select: { nickname: true, email: true } },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: members.map(({ userId, role, user }) => ({
        userId,
        role,
        nickname: user.nickname,
        email: user.email,
      })),
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
 * 타임라인 이름 중복 여부를 확인한다.
 */
export const checkTimelineTitle = async (req: Request, res: Response) => {
  // 1. 요청 검증
  const { name } = req.query as { name: string };

  if (!name) {
    return res.status(400).json({
      message: "이름을 입력해주세요.",
    } as ErrorResponse);
  }

  try {
    // 2. 이름 중복 확인
    const existingTimeline = await prismaService.timeline.findUnique({
      where: { name: name },
    });

    // 이미 사용 중인 이름 있음
    if (existingTimeline) {
      return res
        .status(409)
        .json({ message: "이미 사용 중인 이름입니다." } as ErrorResponse);
    }

    // 사용 중인 이름 없음
    return res.status(200).json({});
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error" } as ErrorResponse);
  }
};

