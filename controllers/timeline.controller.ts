import { Request, Response } from "express";
import {
  getTimelineListSchema,
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

    const newTimeline = await prismaService.timeline.create({
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

