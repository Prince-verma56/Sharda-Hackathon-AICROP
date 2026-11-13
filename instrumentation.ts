/**
 * Runs once when a server instance starts. Refuses to start a production server with the
 * development OTP provider (environment injected at runtime, after the build).
 */
export async function register() {
  const { assertOtpProviderAllowed } = await import('./server/auth/otp/config');
  assertOtpProviderAllowed();
}
