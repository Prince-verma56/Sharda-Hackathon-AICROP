import type { NextConfig } from "next";
import { assertOtpProviderAllowed } from "./server/auth/otp/config";

// The free development OTP provider (no SMS, fixed test code) must never reach production:
// `next build` and `next start` stop here when AUTH_OTP_PROVIDER=dev.
assertOtpProviderAllowed();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
