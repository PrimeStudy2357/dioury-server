-- utf8mb4_unicode_ci는 BMP 밖 문자(대부분의 이모지)를 모두 같은 값으로 비교해 👍와 😂가 PK 충돌하므로 바이너리 비교로 변경
ALTER TABLE `reactions` MODIFY `emoji` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
