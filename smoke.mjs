/*
 * Smoke test: mounts every screen in a JSDOM document and fails if
 * any of them throws during render. Build and lint both pass on code
 * that crashes the moment it runs, so this covers that gap.
 *
 *   npm run smoke
 */
const dom = globalThis.__JSDOM__;

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { MemoryRouter } = await import("react-router-dom");

const { AuthProvider } = await import("./src/auth/AuthContext.jsx");
const { ToastProvider } = await import("./src/components/halo/Toast.jsx");

const LoginPage = (await import("./src/private/pages/LoginPage.jsx")).default;
const SignupPage = (await import("./src/private/pages/SignupPage.jsx")).default;
const VerifyOtpPage = (await import("./src/private/pages/VerifyOtpPage.jsx")).default;
const ForgotPasswordPage = (await import("./src/private/pages/ForgotPasswordPage.jsx")).default;

// The signed-in shell needs a session and the SQLite/WASM layer.
// sql.js can't load its .wasm here, so the engine's init rejects and
// the shell renders its degraded state - which is itself worth
// asserting, since that is what a user with blocked storage sees.
globalThis.localStorage.setItem(
  "halo.session",
  JSON.stringify({
    token: "test-token",
    phone: "+441700900111",
    name: "Amara Osei",
    email: "amara@example.com",
    avatarId: null,
    about: "",
  })
);

const AppPage = (await import("./src/private/pages/AppPage.jsx")).default;

const screens = [
  ["LoginPage", LoginPage, "/"],
  ["SignupPage", SignupPage, "/signup"],
  ["VerifyOtpPage (no email)", VerifyOtpPage, "/verify-otp"],
  ["ForgotPasswordPage", ForgotPasswordPage, "/forgot-password"],
  ["AppPage (signed in)", AppPage, "/app"],
];

/** A phrase that proves the screen got past its loading state. */
const expectations = {
  LoginPage: "Welcome back",
  SignupPage: "Create your account",
  "VerifyOtpPage (no email)": "Nothing to verify",
  ForgotPasswordPage: "Forgot password?",
  "AppPage (signed in)": "Chats",
};

let failures = 0;

for (const [name, Screen, path] of screens) {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);

  try {
    const root = createRoot(host);

    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(
              MemoryRouter,
              { initialEntries: [path] },
              React.createElement(Screen)
            )
          )
        )
      );
    });

    // Let async work settle - the app shell opens SQLite before it
    // can draw anything, so asserting immediately would only ever
    // catch its loading state.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    const text = host.textContent || "";
    if (text.trim().length === 0) throw new Error("rendered nothing");

    const expected = expectations[name];
    if (expected && !text.includes(expected)) {
      throw new Error(`expected to find "${expected}" on screen`);
    }

    // For the signed-in shell specifically: click through to the
    // Private Room and Contacts tabs and check their real content
    // renders. These are exactly the two surfaces reported broken -
    // "Private Room isn't there" and "can't search for a contact" -
    // so asserting the default view alone would miss both.
    if (name === "AppPage (signed in)") {
      const clickTab = async (ariaLabel) => {
        const button = Array.from(host.querySelectorAll("button")).find(
          (el) => el.getAttribute("aria-label") === ariaLabel
        );
        if (!button) throw new Error(`no nav button found for "${ariaLabel}"`);

        await act(async () => {
          button.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
        });
      };

      await clickTab("Private");

      // Entering Private Room now shows the PIN gate first, not the
      // room list directly - that's the point of the lock. The gate's
      // own status check is a real network call (mocked to fail in
      // this environment), so give its promise chain a moment to
      // settle before asserting, the same way the initial mount is
      // given time above.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      const privateText = host.textContent || "";
      const gateRendered =
        privateText.includes("Enter your PIN") ||
        privateText.includes("Choose a PIN") ||
        privateText.includes("Private Room") ||
        privateText.includes("Checking");

      if (!gateRendered) {
        throw new Error("Private Room tab did not render its PIN gate");
      }
      console.log("        + Private Room tab renders and is reachable from the nav");

      await clickTab("Contacts");
      const contactsText = host.textContent || "";
      if (!contactsText.includes("Contacts")) {
        throw new Error("Contacts tab did not render its heading");
      }
      // The search box's prompt is a placeholder attribute, not text
      // content - textContent.includes(...) would silently never see
      // it regardless of whether the field rendered correctly.
      const searchInput = host.querySelector('input[placeholder="Search by name or phone number"]');
      if (!searchInput) {
        throw new Error("Contacts tab did not render its search field");
      }
      console.log("        + Contacts tab renders its search field");
    }

    console.log(`  PASS  ${name}  (${text.trim().slice(0, 52).replace(/\s+/g, " ")}…)`);

    await act(async () => root.unmount());
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${name}\n        ${error.message}`);
  }
}

console.log(failures === 0 ? "\nAll screens rendered." : `\n${failures} screen(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
