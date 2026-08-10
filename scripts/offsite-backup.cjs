#!/usr/bin/env node
/**
 * Off-platform, independently-keyed database backup.
 *
 * Why this exists: Railway's point-in-time recovery and volume snapshots all live
 * inside the same Railway account as production. A compromised or suspended
 * account takes the backups with it, which fails the "backup independence"
 * expectation in SOC 2 CC and in FedRAMP CP-9. This script produces an encrypted
 * pg_dump and stores it under a different provider with a different credential.
 *
 * Nothing here ever prints a secret. Configuration comes from the environment:
 *   DATABASE_URL                    source database
 *   BACKUP_ENCRYPTION_PASSPHRASE    >= 32 chars; AES-256-GCM key via scrypt
 *   BACKUP_S3_ENDPOINT              e.g. https://<account>.r2.cloudflarestorage.com
 *   BACKUP_S3_BUCKET                e.g. ec-db-backups
 *   BACKUP_S3_REGION                defaults to "auto" (correct for R2)
 *   BACKUP_S3_ACCESS_KEY_ID
 *   BACKUP_S3_SECRET_ACCESS_KEY
 *
 * Usage:
 *   node scripts/offsite-backup.cjs --dry-run        validate config, print plan
 *   node scripts/offsite-backup.cjs --local-only     dump + encrypt to disk only
 *   node scripts/offsite-backup.cjs --verify --in F   decrypt F and pg_restore --list
 *   node scripts/offsite-backup.cjs                  dump + encrypt + upload
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { spawnSync } = require("child_process");

const MIN_PASSPHRASE = 32;
const SCRYPT_KEYLEN = 32;
// Pinned explicitly. Without authTagLength, GCM will accept a truncated tag,
// which lets an attacker forge ciphertexts (semgrep gcm-no-tag-length).
const TAG_LENGTH = 16;
const MAGIC = Buffer.from("ECBK1\0\0\0", "utf8"); // 8 bytes, versioned header

function fail(message) {
  console.error("[offsite-backup] " + message);
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i < 0 ? null : (process.argv[i + 1] ?? "");
}
const has = (name) => process.argv.includes(name);

function redactUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol + "//" + u.username + ":***@" + u.host + u.pathname;
  } catch {
    return "(unparseable)";
  }
}

function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) fail("missing required env: " + missing.join(", "));
}

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, SCRYPT_KEYLEN, {
    N: 1 << 15,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
}

function pgDump(databaseUrl, outFile) {
  const res = spawnSync(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", "--file=" + outFile, databaseUrl],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  if (res.error) fail("pg_dump could not be executed: " + res.error.message);
  if (res.status !== 0) fail("pg_dump exited with status " + res.status);
}

/** AES-256-GCM. Layout: MAGIC | salt(16) | iv(12) | ciphertext | tag(16) */
function encryptFile(plainPath, cipherPath, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const plain = fs.readFileSync(plainPath);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const out = Buffer.concat([MAGIC, salt, iv, body, cipher.getAuthTag()]);
  fs.writeFileSync(cipherPath, out);
  return {
    bytes: out.length,
    plainBytes: plain.length,
    sha256: crypto.createHash("sha256").update(out).digest("hex"),
  };
}

function decryptFile(cipherPath, plainPath, passphrase) {
  const raw = fs.readFileSync(cipherPath);
  if (raw.length < MAGIC.length + 16 + 12 + TAG_LENGTH) fail("ciphertext is truncated");
  if (!raw.subarray(0, MAGIC.length).equals(MAGIC)) fail("not an ECBK1 backup file");
  let at = MAGIC.length;
  const salt = raw.subarray(at, (at += 16));
  const iv = raw.subarray(at, (at += 12));
  const tag = raw.subarray(raw.length - TAG_LENGTH);
  const body = raw.subarray(at, raw.length - TAG_LENGTH);
  if (tag.length !== TAG_LENGTH) fail("authentication tag is not " + TAG_LENGTH + " bytes");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveKey(passphrase, salt),
    iv,
    { authTagLength: TAG_LENGTH },
  );
  decipher.setAuthTag(tag);
  let plain;
  try {
    plain = Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    fail("authentication failed - wrong passphrase or the file was tampered with");
  }
  fs.writeFileSync(plainPath, plain);
  return plain.length;
}

const sha256Hex = (b) => crypto.createHash("sha256").update(b).digest("hex");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

/** Minimal AWS SigV4 for a single PutObject. No SDK, no transitive dependencies. */
function signedPutRequest({ endpoint, region, bucket, key, body, accessKeyId, secretAccessKey }) {
  const url = new URL(endpoint);
  const host = url.host;
  const canonicalUri = "/" + bucket + "/" + key.split("/").map(encodeURIComponent).join("/");
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const canonicalHeaders =
    "host:" + host + "\n" +
    "x-amz-content-sha256:" + payloadHash + "\n" +
    "x-amz-date:" + amzDate + "\n";
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash,
  ].join("\n");
  const scope = dateStamp + "/" + region + "/s3/aws4_request";
  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(Buffer.from(canonicalRequest, "utf8")),
  ].join("\n");
  let signingKey = hmac(Buffer.from("AWS4" + secretAccessKey, "utf8"), dateStamp);
  signingKey = hmac(signingKey, region);
  signingKey = hmac(signingKey, "s3");
  signingKey = hmac(signingKey, "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    host,
    canonicalUri,
    canonicalRequest,
    headers: {
      Host: host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Content-Length": String(body.length),
      "Content-Type": "application/octet-stream",
      Authorization:
        "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + scope +
        ", SignedHeaders=" + signedHeaders + ", Signature=" + signature,
    },
  };
}

function put(endpoint, signed, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const req = https.request(
      { method: "PUT", host: signed.host, port: url.port || 443, path: signed.canonicalUri, headers: signed.headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(text);
          else reject(new Error("upload failed " + res.statusCode + ": " + text.slice(0, 400)));
        });
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

async function main() {
  const dryRun = has("--dry-run");
  const localOnly = has("--local-only");
  const verify = has("--verify");
  const passphrase = process.env.BACKUP_ENCRYPTION_PASSPHRASE ?? "";

  if (verify) {
    const inFile = arg("--in");
    if (!inFile) fail("--verify requires --in <file>");
    if (passphrase.length < MIN_PASSPHRASE) fail("BACKUP_ENCRYPTION_PASSPHRASE must be at least " + MIN_PASSPHRASE + " characters");
    const tmp = path.join(os.tmpdir(), "ec-verify-" + Date.now() + ".dump");
    const bytes = decryptFile(inFile, tmp, passphrase);
    const listed = spawnSync("pg_restore", ["--list", tmp], { encoding: "utf8" });
    if (listed.status !== 0) fail("pg_restore --list rejected the decrypted dump");
    const tables = (listed.stdout.match(/^\d+; \d+ \d+ TABLE DATA /gm) ?? []).length;
    fs.unlinkSync(tmp);
    console.log("[offsite-backup] verified: decrypted " + bytes + " bytes, " + tables + " TABLE DATA entries");
    if (tables === 0) fail("dump contains no table data - refusing to call this a good backup");
    return;
  }

  requireEnv(["DATABASE_URL"]);
  if (passphrase.length < MIN_PASSPHRASE) {
    fail("BACKUP_ENCRYPTION_PASSPHRASE must be at least " + MIN_PASSPHRASE + " characters");
  }
  if (!localOnly && !dryRun) {
    requireEnv(["BACKUP_S3_ENDPOINT", "BACKUP_S3_BUCKET", "BACKUP_S3_ACCESS_KEY_ID", "BACKUP_S3_SECRET_ACCESS_KEY"]);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = "postgres/" + stamp + ".pgdump.enc";

  if (dryRun) {
    console.log("[offsite-backup] dry run - nothing was read, written or uploaded");
    console.log("  source          : " + redactUrl(process.env.DATABASE_URL));
    console.log("  passphrase      : configured (" + passphrase.length + " chars, never logged)");
    console.log("  destination     : " + (process.env.BACKUP_S3_ENDPOINT || "(unset)") + "/" + (process.env.BACKUP_S3_BUCKET || "(unset)") + "/" + key);
    console.log("  region          : " + (process.env.BACKUP_S3_REGION || "auto"));
    console.log("  cipher          : AES-256-GCM, scrypt N=2^15 key derivation, per-file salt+iv");
    console.log("  restore proof   : node scripts/offsite-backup.cjs --verify --in <file>");
    return;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-backup-"));
  const dumpPath = path.join(workDir, "db.pgdump");
  const encPath = arg("--out") || path.join(workDir, "db.pgdump.enc");

  pgDump(process.env.DATABASE_URL, dumpPath);
  const meta = encryptFile(dumpPath, encPath, passphrase);
  fs.unlinkSync(dumpPath);

  const manifest = {
    object: key,
    createdAt: new Date().toISOString(),
    cipher: "aes-256-gcm",
    kdf: "scrypt(N=32768,r=8,p=1)",
    encryptedBytes: meta.bytes,
    plaintextBytes: meta.plainBytes,
    sha256: meta.sha256,
  };
  console.log("[offsite-backup] " + JSON.stringify(manifest));

  if (localOnly) {
    console.log("[offsite-backup] local-only: encrypted backup at " + encPath);
    return;
  }

  const body = fs.readFileSync(encPath);
  const signed = signedPutRequest({
    endpoint: process.env.BACKUP_S3_ENDPOINT,
    region: process.env.BACKUP_S3_REGION || "auto",
    bucket: process.env.BACKUP_S3_BUCKET,
    key,
    body,
    accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
  });
  await put(process.env.BACKUP_S3_ENDPOINT, signed, body);
  const manifestKey = key + ".manifest.json";
  const manifestBody = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  const signedManifest = signedPutRequest({
    endpoint: process.env.BACKUP_S3_ENDPOINT,
    region: process.env.BACKUP_S3_REGION || "auto",
    bucket: process.env.BACKUP_S3_BUCKET,
    key: manifestKey,
    body: manifestBody,
    accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
  });
  await put(process.env.BACKUP_S3_ENDPOINT, signedManifest, manifestBody);
  fs.rmSync(workDir, { recursive: true, force: true });
  console.log("[offsite-backup] uploaded " + key + " and " + manifestKey);
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
