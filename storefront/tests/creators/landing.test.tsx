// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";

const trackCreatorEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ trackCreatorEvent }));
vi.mock("@/components/Reveal", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/creators/CreatorStickyApply", () => ({ default: () => null }));
vi.mock("next/image", () => ({
  default: ({ alt, priority: _priority, fill: _fill, unoptimized: _unoptimized, ...props }: ComponentProps<"img"> & { priority?: boolean; fill?: boolean; unoptimized?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={typeof alt === "string" ? alt : ""} {...props} />
  ),
}));

import CreatorLanding from "@/components/creators/CreatorLanding";

describe("CreatorLanding", () => {
  afterEach(() => {
    cleanup();
    trackCreatorEvent.mockClear();
  });

  it("reports the correct CTA placement for hero, editorial and footer application links", () => {
    render(<CreatorLanding supportEmail="support@example.test" application={<div>Application slot</div>} />);

    const applyLinks = screen.getAllByRole("link", { name: /Apply to the collective/ });
    fireEvent.click(applyLinks[0]);
    fireEvent.click(screen.getByRole("link", { name: /Tell us about your work/ }));
    fireEvent.click(applyLinks[1]);

    expect(trackCreatorEvent).toHaveBeenNthCalledWith(1, "creator_cta_click", { placement: "hero" });
    expect(trackCreatorEvent).toHaveBeenNthCalledWith(2, "creator_cta_click", { placement: "editorial" });
    expect(trackCreatorEvent).toHaveBeenNthCalledWith(3, "creator_cta_click", { placement: "footer" });
  });
});
