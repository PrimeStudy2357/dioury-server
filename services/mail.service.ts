import nodemailer from "nodemailer";

class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // 1. 서버 실행 시(이 파일이 로드될 때) 딱 한 번만 실행됨
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER, // .env 파일에서 관리 권장
        pass: process.env.MAIL_PASS,
      },
    });

    // (선택 사항) 연결이 잘 되었는지 서버 시작 시 로그로 확인
    this.transporter.verify((error, success) => {
      if (error) {
        console.error("메일 서버 연결 실패:", error);
      } else {
        console.log("메일 서버가 준비되었습니다.");
      }
    });
  }

  /**
   * 인증 번호 발송 메서드
   */
  async sendVerificationEmail(toEmail: string, code: string): Promise<boolean> {
    const mailOptions = {
      from: `"Dioury" <${process.env.MAIL_USER}>`,
      to: toEmail,
      subject: "[Dioury] 회원가입 인증번호",
      html: `
        <h3>인증번호: ${code}</h3>
        <p>3분 내에 입력해주세요.</p>
      `,
    };

    try {
      // 이미 생성된 this.transporter를 재사용
      await this.transporter.sendMail(mailOptions);
      console.log(`메일 발송 완료: ${toEmail}`);
      return true;
    } catch (error) {
      console.error("메일 발송 중 에러:", error);
      return false;
    }
  }
}

export default new MailService();

