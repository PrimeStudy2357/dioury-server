import e, { Request, Response } from "express";
import { userSchema } from "../schemas/user.schema";
import z from "zod";
import { ErrorResponse } from "../types/response";
import prisma from "../services/connectors/prisma.service";
import bcrypt from "bcrypt";
import { generateRandomCode } from "../services/user.service";
import mailService from "../services/mail.service";
import redisService from "../services/connectors/redis.service";

export const signUpController = async (req: Request, res: Response) => {
  try {
    // 1. 요청 검증
    const validatedData = userSchema.parse(req.body);
    const { email, password, nickname, funnel, purpose } = validatedData;

    // 2. 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({ where: { email } });
    // 이미 사용 중인 이메일 있음
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "이미 가입된 이메일입니다." } as ErrorResponse);
    }

    // 3. 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. 새 사용자 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname,
        funnel,
        purpose,
      },
    });

    const { password: _, ...userWithoutPassword } = newUser;

    return res.status(201).json(userWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(error);
      return res.status(400).json({
        message: "입력 데이터가 유효하지 않습니다.",
      } as ErrorResponse);
    }

    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error" } as ErrorResponse);
  }
};

const REDIS_AUTH_EMAIL_KEY_PREFIX = "dioury-authEmail-";

export const authEmailController = async (req: Request, res: Response) => {
  const email = (req.body as { email: string }).email;

  if (!email) {
    return res.status(400).json({ message: "이메일을 입력해주세요." });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  // 이미 사용 중인 이메일 있음
  if (existingUser) {
    return res
      .status(409)
      .json({ message: "이미 가입된 이메일입니다." } as ErrorResponse);
  }

  // 인증번호 생성
  const code = generateRandomCode();

  // Redis에 생성한 인증번호 + 메일 키 값 쌍 저장
  try {
    await redisService.set(`${REDIS_AUTH_EMAIL_KEY_PREFIX}${email}`, code, {
      expiration: { type: "EX", value: 180 },
    });
  } catch (error) {
    res.status(500).json({ message: "키 저장 실패" } as ErrorResponse);
  }

  // 메일 발송
  const isSent = await mailService.sendVerificationEmail(email, code);

  if (isSent) {
    return res.status(201).json();
  } else {
    res.status(500).json({ message: "메일 발송 실패" } as ErrorResponse);
  }
};

const REDIS_AUTH_EMAIL_CHECK_KEY_PREFIX = "dioury-authEmailCheck-";

export const authEmailCheckController = async (req: Request, res: Response) => {
  const { email, code } = req.body as { email: string; code: string };

  if (!email) {
    return res.status(400).json({ message: "이메일을 입력해주세요." });
  }

  if (!code) {
    return res.status(409).json({ message: "코드를 입력해주세요." });
  }

  try {
    const savedCode = await redisService.get(
      `${REDIS_AUTH_EMAIL_KEY_PREFIX}${email}`,
    );

    if (!savedCode) {
      return res
        .status(404)
        .json({ message: "인증 정보가 없습니다" } as ErrorResponse);
    }

    if (savedCode !== code) {
      return res
        .status(409)
        .json({ message: "인증 번호가 틀렸습니다" } as ErrorResponse);
    }

    await redisService.unlink(`${REDIS_AUTH_EMAIL_KEY_PREFIX}${email}`);

    // 인증 확인 되었음을 레디스에 기록
    await redisService.set(`${REDIS_AUTH_EMAIL_CHECK_KEY_PREFIX}${email}`, 1, {
      expiration: {
        type: "EX",
        value: 600,
      },
    });

    return res.status(200).json({ message: "인증 성공" });
  } catch (error) {
    console.error("Redis Error: ", error);
    return res.status(500).json({ message: "서버 오류" } as ErrorResponse);
  }
};

/**
 * 닉네임 중복 여부를 확인한다.
 */
export const checkNickname = async (req: Request, res: Response) => {
  // 1. 요청 검증
  const { nickname } = req.query as { nickname: string };

  if (!nickname) {
    return res.status(400).json({
      message: "닉네임을 입력해주세요.",
    } as ErrorResponse);
  }

  try {
    // 2. 닉네임 중복 확인
    const existingUser = await prisma.user.findUnique({ where: { nickname } });

    // 이미 사용 중인 닉네임 있음
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "이미 사용 중인 닉네임입니다." } as ErrorResponse);
    }

    // 사용 중인 닉네임 없음
    return res.status(200).json({});
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error" } as ErrorResponse);
  }
};

/** 로그인 */
export const signInController = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // 이메일 확인
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "존재하지 않는 이메일입니다." });
    }

    // 비밀번호 확인
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "비밀번호를 다시 확인해주세요." });
    }

    // 세션에 사용자 정보를 저장
    req.session.email = user.email;
    req.session.nickname = user.nickname;
    req.session.userId = user.id;

    res.status(200).json({ message: "로그인 성공" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류" });
  }
};

/** 로그아웃 */
export const signOutController = async (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "로그아웃 실패" });
    res.clearCookie("connect.sid"); // 세션 쿠키 삭제
    res.status(200).json({ message: "로그아웃되었습니다." });
  });
};

/** 로그인 한 사용자의 자기 자신 정보 조회 */
export const sayMyName = async (req: Request, res: Response) => {
  const userEmail = req.session.email;

  try {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        email: true,
        nickname: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "사용자 정보를 찾을 수 없습니다." });
    }

    return res.status(200).json({
      message: "사용자 조회 성공",
      user,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error" } as ErrorResponse);
  }
};
