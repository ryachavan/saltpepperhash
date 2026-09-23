// utils/hashing.js
//
// Implements three password-protection techniques for the demo:
//   1. Plain (unsalted) hashing        -> hash(password)
//   2. Salted hashing                  -> hash(password + salt)
//   3. Salted + peppered hashing       -> hash(password + salt + pepper)
//
// Salt: random per user, STORED in the database alongside the hash.
// Pepper: random per user, generated once at registration, used to
//         compute the hash, then thrown away (NEVER stored). Because the
//         server doesn't remember it, verifying a login for a
//         salted+peppered user means brute-forcing every possible pepper
//         value until one reproduces the stored hash.

const crypto = require('crypto');

// Small pepper space (single lowercase letter) on purpose - this mirrors
// the textbook example ("pepper is the letter 'e'") and keeps the
// brute-force step at login fast and easy to display step-by-step.
const PEPPER_CHARS = 'abcdefghijklmnopqrstuvwxyz'.split('');

function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function randomSalt(bytes = 8) {
  return crypto.randomBytes(bytes).toString('hex');
}

function randomPepper() {
  return PEPPER_CHARS[crypto.randomInt(0, PEPPER_CHARS.length)];
}

// ---------- Registration-time hashing ----------

function hashPlain(password) {
  return { hash: sha256(password) };
}

function hashSalted(password) {
  const salt = randomSalt();
  const hash = sha256(password + salt);
  return { hash, salt };
}

function hashSaltedPeppered(password) {
  const salt = randomSalt();
  const pepper = randomPepper();
  const hash = sha256(password + salt + pepper);
  // pepperUsedForDemo is returned ONLY so the register endpoint can show
  // it to the user once, for teaching purposes. It is never persisted.
  return { hash, salt, pepperUsedForDemo: pepper };
}

// ---------- Login-time verification ----------

function verifyPlain(password, storedHash) {
  const computedHash = sha256(password);
  return { success: computedHash === storedHash, computedHash };
}

function verifySalted(password, salt, storedHash) {
  const computedHash = sha256(password + salt);
  return { success: computedHash === storedHash, computedHash };
}

// Cycles through every possible pepper value, hashing (password + salt +
// candidate) each time, until one matches the stored hash. Returns every
// attempt made so the dashboard can visualize the brute-force process.
function verifySaltedPeppered(password, salt, storedHash) {
  const attempts = [];
  for (const candidate of PEPPER_CHARS) {
    const attemptHash = sha256(password + salt + candidate);
    const match = attemptHash === storedHash;
    attempts.push({ pepper: candidate, hash: attemptHash, match });
    if (match) {
      return { success: true, pepperFound: candidate, attempts };
    }
  }
  return { success: false, pepperFound: null, attempts };
}

module.exports = {
  PEPPER_CHARS,
  sha256,
  randomSalt,
  randomPepper,
  hashPlain,
  hashSalted,
  hashSaltedPeppered,
  verifyPlain,
  verifySalted,
  verifySaltedPeppered
};
