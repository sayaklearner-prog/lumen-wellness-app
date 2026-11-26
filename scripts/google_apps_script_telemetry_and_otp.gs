/**
 * LUMEN HEALTH OS — GOOGLE APPS SCRIPT WEB APP
 * Unified Telemetry Logger + Real Email OTP Mailer
 *
 * Setup Instructions:
 * 1. Open your "Lumen User Telemetry" Google Sheet -> Extensions -> Apps Script.
 * 2. Replace the entire Code.gs content with this file.
 * 3. Click Save, then Deploy -> Manage Deployments -> Edit (pencil) -> Version: New version -> Deploy.
 * 4. Authorize Google Permissions (MailApp / Spreadsheets) when prompted.
 */

var OTP_TTL_SECONDS = 300;           // 5 minutes validity
var RESEND_COOLDOWN_MS = 60 * 1000;  // 60 seconds between resends
var MAX_VERIFY_ATTEMPTS = 5;         // Max wrong tries before invalidation
var RATE_LIMIT_WINDOW_SEC = 900;     // 15 minutes rate-limit window
var RATE_LIMIT_MAX_REQUESTS = 6;     // Max 6 OTP requests per 15 mins

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function sha256Hex(input) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? "0" + v : v;
    })
    .join("");
}

function testEmailPermission() {
  var quota = MailApp.getRemainingDailyQuota();
  var sheetName = SpreadsheetApp.getActiveSpreadsheet().getName();
  Logger.log("Permissions OK! Sheet: " + sheetName + " | Remaining daily email quota: " + quota);
  return { ok: true, sheet: sheetName, remainingDailyEmailQuota: quota };
}

function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "Lumen Health OS Telemetry & OTP Mailer",
    otpEnabled: true,
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    if (data.action === "send_otp") {
      return handleSendOtp(data);
    }

    if (data.action === "verify_otp") {
      return handleVerifyOtp(data);
    }

    // Default behavior: append row to Telemetry Google Sheet
    return handleTelemetryLog(data);
  } catch (err) {
    return jsonResponse({
      success: false,
      status: "error",
      error: "Server processing error: " + err.toString()
    });
  }
}

function handleSendOtp(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var purpose = data.purpose === "signin" ? "signin" : "signup";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({
      success: false,
      error: "Please enter a valid email address."
    });
  }

  var lock = LockService.getScriptLock();
  lock.tryLock(5000);

  try {
    var cache = CacheService.getScriptCache();
    var emailHash = sha256Hex(email).slice(0, 32);
    var otpKey = "otp_" + emailHash;
    var rateKey = "rl_" + emailHash;
    var now = Date.now();

    // 1. Rate-limit check (max 6 per 15 mins per email)
    var rawRate = cache.get(rateKey);
    var rateCount = rawRate ? parseInt(rawRate, 10) : 0;
    if (rateCount >= RATE_LIMIT_MAX_REQUESTS) {
      return jsonResponse({
        success: false,
        error: "Too many verification requests. Please wait 15 minutes and try again."
      });
    }

    // 2. Resend cooldown check (60 seconds)
    var existingRaw = cache.get(otpKey);
    if (existingRaw) {
      var existing = JSON.parse(existingRaw);
      if (existing.lastSentAt && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
        var waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
        return jsonResponse({
          success: false,
          error: "Please wait " + waitSeconds + " seconds before requesting another code.",
          cooldownRemainingSeconds: waitSeconds
        });
      }
    }

    // 3. Generate secure 6-digit OTP & send real HTML email via MailApp first
    var rawOtp = String(Math.floor(100000 + Math.random() * 900000));
    var salt = Utilities.getUuid();
    var hashedOtp = sha256Hex(rawOtp + ":" + salt + ":lumen-os-otp-v1");

    var subject = purpose === "signup"
      ? "Welcome to Lumen OS — Your Verification Code"
      : "Lumen OS — Your Login Verification Code";
    var actionText = purpose === "signup"
      ? "complete your account verification"
      : "sign in to your Lumen OS account";

    var plainBody =
      "Lumen Health OS Verification Code: " + rawOtp + "\n\n" +
      "Use this 6-digit code to " + actionText + " for " + email + ".\n" +
      "This code expires in 5 minutes and can only be used once.\n\n" +
      "If you did not request this code, you can safely ignore this email.";

    var htmlBody =
      '<div style="margin:0;padding:32px 16px;background-color:#050b08;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#f8fafc;">' +
        '<div style="max-width:500px;margin:0 auto;background-color:#0b1410;border-radius:20px;border:1px solid rgba(16,185,129,0.3);padding:32px;">' +
          '<div style="text-align:center;margin-bottom:24px;">' +
            '<h1 style="margin:0;font-size:22px;font-weight:800;color:#10b981;">Lumen Health OS</h1>' +
            '<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Bio-Intelligence &amp; Personal Health Platform</p>' +
          '</div>' +
          '<p style="font-size:14px;line-height:22px;color:#cbd5e1;margin:0 0 18px;">' +
            'Use the one-time security code below to ' + actionText + ' for <strong style="color:#ffffff;">' + email + '</strong>:' +
          '</p>' +
          '<div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.35);border-radius:14px;padding:22px;text-align:center;margin:20px 0;">' +
            '<div style="font-size:10px;letter-spacing:1.6px;color:#10b981;font-weight:700;text-transform:uppercase;">ONE-TIME VERIFICATION CODE</div>' +
            '<div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#10b981;font-family:monospace;margin:10px 0 6px;">' + rawOtp + '</div>' +
            '<div style="font-size:12px;color:#94a3b8;">Valid for 5 minutes • Single-use only</div>' +
          '</div>' +
          '<p style="font-size:12px;line-height:18px;color:#64748b;margin:20px 0 0;text-align:center;">' +
            'If you did not request this verification code, please ignore this email.' +
          '</p>' +
        '</div>' +
      '</div>';

    MailApp.sendEmail(email, subject, plainBody, {
      name: "Lumen Health OS",
      htmlBody: htmlBody
    });

    // 4. Store salted SHA-256 hash in CacheService only after MailApp succeeds
    var record = {
      email: email,
      hashedOtp: hashedOtp,
      salt: salt,
      attempts: 0,
      lastSentAt: now,
      expiresAt: now + OTP_TTL_SECONDS * 1000,
      purpose: purpose
    };

    cache.put(otpKey, JSON.stringify(record), OTP_TTL_SECONDS);
    cache.put(rateKey, String(rateCount + 1), RATE_LIMIT_WINDOW_SEC);

    return jsonResponse({
      success: true,
      otpDispatched: true,
      provider: "apps_script_mailer",
      message: "Verification code sent to " + email,
      expiresInSeconds: OTP_TTL_SECONDS
    });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handleVerifyOtp(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var otp = String(data.otp || "").trim();

  if (!/^\d{6}$/.test(otp)) {
    return jsonResponse({
      success: false,
      error: "Please enter a valid 6-digit verification code."
    });
  }

  var lock = LockService.getScriptLock();
  lock.tryLock(5000);

  try {
    var cache = CacheService.getScriptCache();
    var emailHash = sha256Hex(email).slice(0, 32);
    var otpKey = "otp_" + emailHash;
    var rawRecord = cache.get(otpKey);

    if (!rawRecord) {
      return jsonResponse({
        success: false,
        error: "Verification code expired or not found. Please request a new code."
      });
    }

    var record = JSON.parse(rawRecord);
    var now = Date.now();

    if (now > record.expiresAt) {
      cache.remove(otpKey);
      return jsonResponse({
        success: false,
        error: "Verification code has expired. Please request a new code."
      });
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      cache.remove(otpKey);
      return jsonResponse({
        success: false,
        error: "Maximum failed attempts exceeded. Please request a new code."
      });
    }

    var candidateHash = sha256Hex(otp + ":" + record.salt + ":lumen-os-otp-v1");
    if (candidateHash !== record.hashedOtp) {
      record.attempts = (record.attempts || 0) + 1;
      var remaining = MAX_VERIFY_ATTEMPTS - record.attempts;

      if (remaining <= 0) {
        cache.remove(otpKey);
        return jsonResponse({
          success: false,
          error: "Maximum failed attempts exceeded. Please request a new code.",
          remainingAttempts: 0
        });
      }

      var remainingSec = Math.max(10, Math.ceil((record.expiresAt - now) / 1000));
      cache.put(otpKey, JSON.stringify(record), remainingSec);

      return jsonResponse({
        success: false,
        error: "Incorrect verification code. " + remaining + " attempt" + (remaining === 1 ? "" : "s") + " remaining.",
        remainingAttempts: remaining
      });
    }

    // Verified! Delete OTP immediately so it cannot be reused
    cache.remove(otpKey);
    var sessionToken = Utilities.getUuid() + "-" + sha256Hex(email + ":" + now).slice(0, 24);

    return jsonResponse({
      success: true,
      verified: true,
      message: "Email address verified successfully.",
      token: sessionToken,
      email: email,
      verifiedAt: new Date().toISOString()
    });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handleTelemetryLog(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("User_Registration_Log")
           || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  sheet.appendRow([
    data.timestamp || new Date().toLocaleString(),
    data.name || "User",
    data.email || "N/A",
    data.event || "General",
    data.platform || "N/A",
    data.healthMode || "N/A",
    data.calorieTarget || "N/A",
    data.sleepTarget || "N/A",
    data.stepsTarget || "N/A",
    data.appVersion || "1.0.0",
    data.location || "N/A",
    data.city || "N/A",
    data.country || "N/A",
    data.coordinates || "N/A"
  ]);

  return jsonResponse({ status: "success", success: true });
}
