import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ============================================================================
// 1. SECURITY & IN-MEMORY TEMPORARY STORAGE CONFIGURATION
// ============================================================================

interface OtpRecord {
  email: string;
  hashedOtp: string;
  salt: string;
  expiresAt: number;     // Milliseconds timestamp (5 minutes)
  attempts: number;      // Failed verification counter (max 5)
  lastSentAt: number;    // Cooldown timer (60 seconds)
  purpose: "signup" | "signin";
  createdAt: number;
}

// In-Memory Temporary Storage for OTPs
const otpStore = new Map<string, OtpRecord>();

// Rate limiting map: tracks requests per identifier (email or IP)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const OTP_TTL_MS = 5 * 60 * 1000;         // 5 minutes expiry
const RESEND_COOLDOWN_MS = 60 * 1000;      // 60 seconds resend cooldown
const MAX_VERIFY_ATTEMPTS = 5;             // Max failed attempts before lockout
const RATE_LIMIT_MAX_REQUESTS = 6;         // Max 6 requests per 15 minutes window
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// Periodic cleanup of expired OTPs every 3 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(key);
    }
  }
  for (const [key, limit] of rateLimitStore.entries()) {
    if (now > limit.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 3 * 60 * 1000);

// ============================================================================
// 2. HELPER UTILITIES: GENERATION, HASHING & RATE LIMITING
// ============================================================================

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
function generateSecureOtp(): string {
  // randomInt in [100000, 999999]
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP with a unique cryptographic salt using SHA-256
 */
function hashOtp(otp: string, salt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${otp}:${salt}:${process.env.OTP_SECRET || "lumen-secure-secret-2026"}`)
    .digest("hex");
}

/**
 * Constant-time comparison to prevent timing side-channel attacks
 */
function verifyHashedOtp(userInputOtp: string, record: OtpRecord): boolean {
  const expectedHash = hashOtp(userInputOtp, record.salt);
  const a = Buffer.from(expectedHash, "hex");
  const b = Buffer.from(record.hashedOtp, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Check and increment rate limiting
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  current.count += 1;
  return true;
}

// ============================================================================
// 3. EMAIL DISPATCHER (SMTP / TRANSACTIONAL API)
// ============================================================================

interface EmailOptions {
  to: string;
  otp: string;
  purpose: "signup" | "signin";
}

async function sendVerificationEmail({ to, otp, purpose }: EmailOptions): Promise<{ sent: boolean; simulated?: boolean }> {
  const subject = purpose === "signup"
    ? "Welcome to Lumen OS — Your Verification Code"
    : "Lumen OS — Your Login Verification Code";

  const actionText = purpose === "signup" ? "complete your manual sign up" : "sign in to your account";

  // Check if SMTP environment variables are present
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || `"Lumen Health OS" <security@lumen.ai>`;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      // If nodemailer is available in runtime
      const nodemailer = await import("nodemailer" as any).catch(() => null);
      if (nodemailer && (nodemailer as any).createTransport) {
        const transporter = (nodemailer as any).createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: fromEmail,
          to,
          subject,
          text: `Your Lumen OS verification code is: ${otp}. It will expire in 5 minutes.`,
          html: buildHtmlEmailTemplate(otp, to, actionText),
        });

        logger.info({ email: to, purpose }, "Verification email sent successfully via SMTP");
        return { sent: true };
      }
    } catch (smtpErr: any) {
      logger.warn({ error: smtpErr?.message, email: to }, "SMTP dispatch error, fallback to simulated preview");
    }
  }

  // Safe Development / Preview Logger when SMTP credentials are not yet configured
  logger.info(
    {
      to,
      otp,
      purpose,
      notice: "SMTP credentials not provided in .env (SMTP_HOST, SMTP_USER, SMTP_PASS). Using simulated email dispatcher.",
    },
    `📧 [LUMEN EMAIL DISPATCH] Verification OTP for ${to}: >>> ${otp} <<< (Expires in 5 mins)`
  );

  return { sent: true, simulated: true };
}

function buildHtmlEmailTemplate(otp: string, email: string, actionText: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lumen OS Verification Code</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #050b08; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #050b08; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #0b1410; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.25); overflow: hidden; padding: 36px 32px;">
            <tr>
              <td align="center" style="padding-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); text-align: center; font-size: 24px;">🌱</div>
                <h1 style="margin: 12px 0 4px; font-size: 22px; font-weight: 800; color: #f8fafc; letter-spacing: -0.5px;">Lumen OS</h1>
                <p style="margin: 0; font-size: 13px; color: #94a3b8; font-weight: 500;">Bio-Intelligence & Digital Wellbeing</p>
              </td>
            </tr>
            <tr>
              <td>
                <p style="font-size: 15px; line-height: 24px; color: #cbd5e1; margin: 0 0 16px;">
                  Hello,
                </p>
                <p style="font-size: 14px; line-height: 22px; color: #94a3b8; margin: 0 0 24px;">
                  Use the one-time verification code below to ${actionText} for <strong style="color: #f8fafc;">${email}</strong>.
                </p>
                
                <!-- Verification Code Box -->
                <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 14px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #10b981; font-weight: 700;">ONE-TIME SECURITY CODE</span>
                  <div style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #10b981; font-family: monospace; margin: 12px 0 8px;">
                    ${otp}
                  </div>
                  <span style="font-size: 12px; color: #64748b;">Valid for 5 minutes • Single-use only</span>
                </div>

                <p style="font-size: 12px; line-height: 18px; color: #64748b; margin: 24px 0 0; text-align: center;">
                  If you did not request this verification code, please disregard this email. Your account remains secure.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #475569;">
                  © ${new Date().getFullYear()} Lumen Health OS by MeshMind • Biometric Privacy Shield
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

// ============================================================================
// 4. API ENDPOINTS: /auth/send-otp & /auth/verify-otp
// ============================================================================

/**
 * POST /api/auth/send-otp
 * Body: { email: string, purpose?: "signup" | "signin" }
 */
router.post("/auth/send-otp", async (req: Request, res: Response) => {
  try {
    const { email, purpose = "signup" } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        error: "Valid email address is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format. Please provide a valid email address.",
      });
    }

    // Check IP & Email rate limits
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
    if (!checkRateLimit(`ip:${clientIp}`) || !checkRateLimit(`email:${normalizedEmail}`)) {
      return res.status(429).json({
        success: false,
        error: "Too many OTP requests. Please wait a few minutes before trying again.",
      });
    }

    // Check resend cooldown
    const existingRecord = otpStore.get(normalizedEmail);
    const now = Date.now();
    if (existingRecord && now - existingRecord.lastSentAt < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existingRecord.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting a new code.`,
        cooldownRemainingSeconds: waitSeconds,
      });
    }

    // 1. Generate 6-digit OTP
    const rawOtp = generateSecureOtp();
    const salt = crypto.randomBytes(16).toString("hex");
    const hashedOtp = hashOtp(rawOtp, salt);

    // 2. Save in Temporary In-Memory Storage
    const record: OtpRecord = {
      email: normalizedEmail,
      hashedOtp,
      salt,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: now,
      purpose,
      createdAt: now,
    };
    otpStore.set(normalizedEmail, record);

    // 3. Send the Email
    const result = await sendVerificationEmail({
      to: normalizedEmail,
      otp: rawOtp,
      purpose,
    });

    logger.info(
      { email: normalizedEmail, purpose, simulated: result.simulated },
      "OTP generated and sent"
    );

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}`,
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      // In development or when SMTP is simulated, return devOtp to facilitate seamless local testing
      ...(result.simulated ? { devOtp: rawOtp } : {}),
    });
  } catch (error: any) {
    logger.error({ error: error?.message }, "Failed to send OTP");
    return res.status(500).json({
      success: false,
      error: "Unable to process OTP request at this time. Please try again.",
    });
  }
});

/**
 * POST /api/auth/verify-otp
 * Body: { email: string, otp: string, purpose?: "signup" | "signin" }
 */
router.post("/auth/verify-otp", async (req: Request, res: Response) => {
  try {
    const { email, otp, purpose = "signup" } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: "Both email and 6-digit OTP code are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        error: "OTP must be exactly 6 digits.",
      });
    }

    // 1. Lookup temporary record
    const record = otpStore.get(normalizedEmail);
    if (!record) {
      return res.status(400).json({
        success: false,
        error: "No active verification code found for this email. Please request a new code.",
      });
    }

    const now = Date.now();

    // 2. Check Expiry
    if (now > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({
        success: false,
        error: "Verification code has expired. Please request a new code.",
      });
    }

    // 3. Check Attempt Counter
    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      otpStore.delete(normalizedEmail);
      return res.status(429).json({
        success: false,
        error: "Maximum failed attempts exceeded. This code has been invalidated for security. Please request a new code.",
      });
    }

    // 4. Verify cryptographic hash
    const isValid = verifyHashedOtp(cleanOtp, record);
    if (!isValid) {
      record.attempts += 1;
      const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
      return res.status(400).json({
        success: false,
        error: remaining > 0
          ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Incorrect verification code. Maximum attempts reached.",
        remainingAttempts: remaining,
      });
    }

    // 5. Verification Success: Invalidate OTP to prevent replay attacks
    otpStore.delete(normalizedEmail);

    // 6. Generate authenticated session token
    const sessionToken = crypto.randomBytes(32).toString("hex");

    logger.info({ email: normalizedEmail, purpose }, "OTP verified successfully");

    return res.status(200).json({
      success: true,
      verified: true,
      message: "Email address verified successfully",
      token: sessionToken,
      email: normalizedEmail,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error({ error: error?.message }, "Failed to verify OTP");
    return res.status(500).json({
      success: false,
      error: "Verification service error. Please try again.",
    });
  }
});

export default router;
