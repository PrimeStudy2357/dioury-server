import crypto from "crypto";

/**
 * 6자리 난수 생성
 */
export const generateRandomCode = () => {
  // 0 이상 1000000 미만의 정수 (0 ~ 999999) 생성
  const randomNum = crypto.randomInt(0, 1000000);

  // 숫자를 문자열로 변환 후, 6자리가 안 되면 앞에 '0'을 채움 (예: 123 -> "000123")
  return randomNum.toString().padStart(6, "0");
};

