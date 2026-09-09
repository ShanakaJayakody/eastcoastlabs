import type { Instrumentation } from "next";

/** Structured diagnostics without request URLs, cookies, tokens, payloads or
 * customer fields. The hosting log sink can alert on this stable event shape. */
export const onRequestError: Instrumentation.onRequestError = (error, _request, context) => {
  const digest = error && typeof error === "object" && "digest" in error && typeof error.digest === "string" ? error.digest : undefined;
  console.error(JSON.stringify({ event:"application_error", route:context.routePath, operation:context.routeType, digest }));
};
