/**
 * Bun preload that neuters the `server-only` guard.
 *
 * Admin libraries import "server-only" so Next fails the build if they ever get
 * pulled into a client bundle. A CLI probe IS the server, but the package throws
 * on sight outside a React server context — so scripts that exercise those
 * libraries directly preload this.
 *
 * Usage:  bun --preload ./scripts/_stub-server-only.js scripts/<probe>.ts
 */
import { plugin } from "bun"; // eslint-disable-line import/no-unresolved

plugin({
  name: "stub-server-only",
  setup(build) {
    build.module("server-only", () => ({ exports: {}, loader: "object" }));
  },
});
