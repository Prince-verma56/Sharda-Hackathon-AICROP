/**
 * OTP delivery. `mock` is development-only and never logs the code — it is returned to
 * the caller so the dev UI can display it in a clearly labelled banner. `twilio` sends a
 * real SMS (configured but must be live-tested with real credentials before launch).
 */
import 'server-only';

export interface SmsDelivery {
  mode: 'mock' | 'twilio';
  /** Only populated in mock mode outside production. */
  devCode?: string;
}

export interface SmsSender {
  sendOtp(phone: string, code: string, language: string): Promise<SmsDelivery>;
}

const MESSAGES: Record<string, (code: string, brand: string) => string> = {
  hi: (code, brand) => `${code} आपका ${brand} लॉगिन कोड है। यह 5 मिनट में समाप्त होगा। इसे किसी से साझा न करें।`,
  en: (code, brand) => `${code} is your ${brand} login code. It expires in 5 minutes. Do not share it.`,
};

class MockSmsSender implements SmsSender {
  async sendOtp(_phone: string, code: string): Promise<SmsDelivery> {
    if (process.env.NODE_ENV === 'production') throw new Error('OTP_NOT_CONFIGURED');
    return { mode: 'mock', devCode: code };
  }
}

class TwilioSmsSender implements SmsSender {
  async sendOtp(phone: string, code: string, language: string): Promise<SmsDelivery> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) throw new Error('OTP_NOT_CONFIGURED');
    const brand = process.env.NEXT_PUBLIC_BRAND_NAME || 'CropAI';
    const body = (MESSAGES[language] ?? MESSAGES.en)(code, brand);
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: from, Body: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('OTP_DELIVERY_FAILED');
    return { mode: 'twilio' };
  }
}

export function getSmsSender(): SmsSender {
  const mode = (process.env.OTP_MODE || 'mock').toLowerCase();
  if (mode === 'real' || mode === 'twilio') return new TwilioSmsSender();
  return new MockSmsSender();
}

export function otpDeliveryMode(): 'mock' | 'twilio' {
  const mode = (process.env.OTP_MODE || 'mock').toLowerCase();
  return mode === 'real' || mode === 'twilio' ? 'twilio' : 'mock';
}
