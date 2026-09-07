import axios from "axios";
import { API_HOST, API_PORT, API_PROTOCOL } from "../constant/config.js";
import { readStoredSession } from "../../auth/authStore.js";
import { emitSessionExpired } from "./sessionEvents.js";

const serverBaseURL = API_PORT
  ? `${API_PROTOCOL}://${API_HOST}:${API_PORT}`
  : `${API_PROTOCOL}://${API_HOST}`;

const api = axios.create({
  baseURL: serverBaseURL,
  headers: {
    "Content-Type": "application/json",
  },
});


/*
Reads the token from the one real session record (authStore's
"halo.session") rather than a separately mirrored "authToken" key in
localStorage.

Those two used to be able to drift: persistSession() writes both on
every sign-in, but anything that ever touched just one of them -
a future edit, a partial failure mid-write, a browser extension
clearing individual keys - would leave this interceptor silently
attaching a stale or missing token while the app's own session state
looked perfectly fine. Reading the single source of truth removes an
entire class of "requests go out unauthenticated for no visible
reason" bugs.
*/
api.interceptors.request.use(
  (config) => {
    const token = readStoredSession()?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/*
A 401 from an authenticated endpoint means the token this browser is
holding no longer validates - it expired, or (see JwtUtil) the
backend restarted and re-signed with a different key. Either way,
nothing else this session does will work until the person signs in
again, and leaving them on a screen that just keeps failing silently
is worse than telling them plainly.

Login and signup are deliberately excluded: a 401 from POST
/api/login/login-user means "wrong password," not "your session
expired" - those requests were never authenticated to begin with, so
this must not trigger a sign-out-and-redirect loop on the login page
itself.
*/
const PUBLIC_PREFIXES = ["/api/auth", "/api/login"];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    const isPublicEndpoint = PUBLIC_PREFIXES.some((prefix) => url.startsWith(prefix));

    if (status === 401 && !isPublicEndpoint) {
      emitSessionExpired();
    }

    return Promise.reject(error);
  }
);

export default api;
