import crypto from "crypto";

const ITERATIONS = 150000;
const KEYLEN = 64;
const DIGEST = "sha512";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEYLEN, DIGEST, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `pbkdf2$${ITERATIONS}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [algo, iterStr, salt, hashHex] = stored.split("$");
    if (!algo || !iterStr || !salt || !hashHex) return false;
    const iterations = Number(iterStr.replace(/[^0-9]/g, "")) || ITERATIONS;
    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, KEYLEN, DIGEST, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    return crypto.timingSafeEqual(Buffer.from(hashHex, "hex"), derived);
  } catch {
    return false;
  }
}

