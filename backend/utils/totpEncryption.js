const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key) {
    console.warn(
      "[TOTP] TOTP_ENCRYPTION_KEY not set — TOTP secrets will be stored in plain text.",
    );
    return null;
  }
  return crypto.createHash("sha256").update(key).digest();
}

function encryptSecret(plaintext) {
  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptSecret(stored) {
  if (!stored || !stored.startsWith("enc:")) {
    return stored;
  }

  const key = getEncryptionKey();
  if (!key) {
    console.error(
      "[TOTP] Cannot decrypt — TOTP_ENCRYPTION_KEY is not set but encrypted secret found.",
    );
    return null;
  }

  const parts = stored.split(":");
  if (parts.length !== 4) return null;

  const iv = Buffer.from(parts[1], "hex");
  const authTag = Buffer.from(parts[2], "hex");
  const encrypted = Buffer.from(parts[3], "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

module.exports = { encryptSecret, decryptSecret };
