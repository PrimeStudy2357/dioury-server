/**
 * 개발 환경용 더미 데이터 시딩 스크립트.
 * - 가상 유저들을 생성하고
 * - 타임라인 멤버 검색 API(/timeline/:id/members) 테스트를 위해
 *   기존 타임라인에 위 유저들을 TimelineMember 로 등록
 *
 * 실행: node prisma/seed.js
 * 여러 번 실행해도 안전하도록 upsert 를 사용한다.
 *
 * seed.config.js 파일은 담당자에게 요청
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

let seedConfig;
try {
  seedConfig = require("./seed.config");
} catch (error) {
  if (error.code === "MODULE_NOT_FOUND") {
    console.error(
      "prisma/seed.config.js 를 찾을 수 없습니다. " +
        "prisma/seed.config.example.js 를 prisma/seed.config.js 로 복사한 뒤 다시 실행해주세요.",
    );
    process.exit(1);
  }
  throw error;
}

const { SEED_PASSWORD, FUNNELS, PURPOSES, SEED_NICKNAMES, TARGET_TIMELINE_ID } =
  seedConfig;

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);

  const timeline = await prisma.timeline.findUnique({
    where: { id: TARGET_TIMELINE_ID },
  });

  if (!timeline) {
    throw new Error(
      `타임라인 id=${TARGET_TIMELINE_ID} 을 찾을 수 없습니다. TARGET_TIMELINE_ID 를 확인해주세요.`,
    );
  }

  const users = [];

  for (let i = 0; i < SEED_NICKNAMES.length; i++) {
    const nickname = SEED_NICKNAMES[i];
    const email = `seed${String(i + 1).padStart(2, "0")}@dioury.test`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hashedPassword,
        nickname,
        funnel: FUNNELS[i % FUNNELS.length],
        purpose: PURPOSES[i % PURPOSES.length],
      },
    });

    users.push(user);
  }

  console.log(
    `가상 유저 ${users.length}명 생성 완료 (비밀번호: ${SEED_PASSWORD})`,
  );

  // 대부분 MEMBER, 일부는 FRIEND/ADMIN 으로 등록해 역할별 검색도 테스트 가능하게 한다.
  for (let i = 0; i < users.length; i++) {
    const role = i === 0 ? "ADMIN" : i % 4 === 0 ? "FRIEND" : "MEMBER";

    await prisma.timelineMember.upsert({
      where: {
        userId_timelineId: {
          userId: users[i].id,
          timelineId: TARGET_TIMELINE_ID,
        },
      },
      update: { role },
      create: {
        userId: users[i].id,
        timelineId: TARGET_TIMELINE_ID,
        role,
      },
    });
  }

  const memberCnt = await prisma.timelineMember.count({
    where: { timelineId: TARGET_TIMELINE_ID },
  });

  await prisma.timeline.update({
    where: { id: TARGET_TIMELINE_ID },
    data: { memberCnt },
  });

  console.log(
    `타임라인 id=${TARGET_TIMELINE_ID} (${timeline.name}) 에 멤버 ${memberCnt}명 등록 완료`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

