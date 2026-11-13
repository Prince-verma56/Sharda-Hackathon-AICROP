import { OtpProvider } from '../interface';

/**
 * Template mock kept for compatibility. CropAI uses server/auth/otp.ts instead.
 * Never log OTP values (codes in logs are a credential leak).
 */
export class MockOtpProvider implements OtpProvider {
  private codes = new Map<string, string>();

  async sendCode(identifier: string) {
    const code = '123456'; // Fixed for mock
    this.codes.set(identifier, code);
    return true;
  }

  async verifyCode(identifier: string, code: string) {
    const stored = this.codes.get(identifier);
    return stored === code;
  }

  async invalidateCode(identifier: string) {
    this.codes.delete(identifier);
  }
}
