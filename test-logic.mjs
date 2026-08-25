/*
 * Unit tests for the pure helpers. No DOM, no network - just the
 * logic that several screens depend on agreeing about.
 *
 *   npm run test:unit
 */
import { avatarColors, avatarStyleFor, initialsFrom } from "./src/lib/avatar.js";
import { scorePassword } from "./src/lib/password.js";
import { maskEmail, readError, truncate } from "./src/lib/format.js";

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);

  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return;
  }

  console.log(`  PASS  ${name}`);
}

function checkThat(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

console.log("\navatar");

// The whole point of hashing the phone number is that a contact keeps
// the same colour forever, on every device, with no stored state.
const first = avatarStyleFor("+441700900110").id;
const again = avatarStyleFor("+441700900110").id;
check("same seed gives the same style", first, again);

checkThat(
  "different seeds spread across styles",
  new Set(
    ["+1", "+2", "+3", "+4", "+5", "+6", "+7", "+8", "+9", "+10"].map(
      (seed) => avatarStyleFor(seed).id
    )
  ).size >= 4,
  "ten seeds collapsed into fewer than four styles"
);

// FNV-1a was chosen over summing char codes precisely so anagrams
// don't collide.
checkThat(
  "anagram seeds don't collide",
  avatarStyleFor("Ana").id !== avatarStyleFor("Naa").id ||
    avatarStyleFor("abc").id !== avatarStyleFor("cba").id,
  "hash appears order-insensitive"
);

check("explicit style wins over the hash", avatarStyleFor("+44", "moss").id, "moss");
check("unknown style falls back to the hash", avatarStyleFor("+44", "nope").id, avatarStyleFor("+44").id);

check("initials from two names", initialsFrom("Amara Osei"), "AO");
check("initials from three names use first and last", initialsFrom("Ada Grace Lovelace"), "AL");
check("initials from one name", initialsFrom("amara"), "AM");
check("initials from empty", initialsFrom(""), "?");

checkThat(
  "colours are returned as oklch",
  avatarColors("+44").background.startsWith("oklch("),
  avatarColors("+44").background
);

console.log("\npassword");

check("empty scores -1", scorePassword("").score, -1);
check("under 8 characters scores 0", scorePassword("abc123").score, 0);
checkThat("a long mixed password scores 4", scorePassword("Corr3ct-Horse-Battery!").score === 4);
checkThat(
  "an 8-char lowercase password is weak but allowed",
  scorePassword("password").score >= 1 && scorePassword("password").score < 3
);
checkThat(
  "missing pieces are reported",
  scorePassword("alllowercase").missing.includes("a capital letter")
);

console.log("\nformat");

// "amara" is 5 characters: first + (5-2) stars + last.
check("masks a normal address", maskEmail("amara@example.com"), "a***a@example.com");
check("caps the stars on a long local part", maskEmail("bartholomew@example.com"), "b*****w@example.com");
check("masks a two-letter local part", maskEmail("ab@example.com"), "a***@example.com");
check("leaves a non-address alone", maskEmail("not-an-email"), "not-an-email");

check("truncate leaves short text", truncate("hello", 10), "hello");
check("truncate adds an ellipsis", truncate("hello there friend", 8), "hello th…");

check(
  "readError prefers the server message",
  readError({ response: { data: { message: "Nope" } } }),
  "Nope"
);
check(
  "readError explains a network failure",
  readError({ code: "ERR_NETWORK" }),
  "Can't reach the server. Check your connection and try again."
);
check("readError falls back", readError(null, "fallback"), "fallback");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

console.log("\nserver reachability");

{
  const { pingServer, backendAddress } = await import("./src/lib/health.js");
  const originalFetch = globalThis.fetch;

  // A healthy backend.
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  check("reports reachable on a 200", (await pingServer()).reachable, true);

  // Backend is up but the route 404s (e.g. an older deployed jar) -
  // still a real HTTP response, just not a success one.
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  check("reports unreachable on a non-2xx", (await pingServer()).reachable, false);

  // The failure that CORS and a dead server both produce: fetch
  // rejects outright, with no status to inspect.
  globalThis.fetch = async () => {
    throw new Error("Failed to fetch");
  };
  check("reports unreachable when fetch throws", (await pingServer()).reachable, false);

  // A hung connection should time out rather than leave the caller
  // waiting forever; pingServer aborts via AbortController.
  globalThis.fetch = (url, options) =>
    new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  const timedOut = await pingServer();
  checkThat("a hung request eventually resolves rather than hanging", timedOut.reachable === false);

  globalThis.fetch = originalFetch;

  checkThat(
    "backendAddress reports host and port together",
    backendAddress().includes(":"),
    backendAddress()
  );
}
