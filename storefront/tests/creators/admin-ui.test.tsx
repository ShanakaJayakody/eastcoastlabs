// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreatorApplicationDetail from "@/components/admin/CreatorApplicationDetail";
import type { CreatorApplicationRow } from "@/lib/creators/types";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const application = (overrides: Partial<CreatorApplicationRow> = {}): CreatorApplicationRow => ({
  id: "30000000-0000-0000-0000-000000000001",
  created_at: "2026-09-09T01:00:00.000Z",
  updated_at: "2026-09-09T01:00:00.000Z",
  name: "Taylor Example",
  email: "taylor@example.test",
  phone: "+61412345678",
  social_url: "https://instagram.com/taylor.example/",
  portfolio_url: "",
  discipline: "video",
  focus: "health",
  focus_detail: null,
  region: "VIC",
  pitch: "I create practical health stories with polished vertical video and clear product framing.",
  audience: "",
  audience_size: 1200,
  adult_australia: true,
  contact_consent: true,
  privacy_version: "creator-privacy-2026-09-09",
  consent_at: "2026-09-09T01:00:00.000Z",
  status: "new",
  revision: 0,
  reviewer_email: null,
  internal_notes: "",
  ...overrides,
});

describe("CreatorApplicationDetail", () => {
  it("shows phone, exact audience count and custom Other focus details", () => {
    render(<CreatorApplicationDetail application={application({
      focus: "other",
      focus_detail: "Recovery routines",
      audience_size: 0,
      audience: "10k-50k",
    } as Partial<CreatorApplicationRow>)} review={vi.fn()} />);

    expect(screen.getByText("+61412345678")).toBeInTheDocument();
    expect(screen.getByText(/other: Recovery routines/)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("marks missing new fields as not provided and falls back to legacy audience ranges", () => {
    render(<CreatorApplicationDetail application={application({
      phone: null,
      focus_detail: null,
      audience_size: null,
      audience: "10k-50k",
    } as Partial<CreatorApplicationRow>)} review={vi.fn()} />);

    expect(screen.getByText("Not provided")).toBeInTheDocument();
    expect(screen.getByText("10k-50k")).toBeInTheDocument();
  });

  it("blocks stale resubmission until the refreshed record resets local review state", async () => {
    const user = userEvent.setup();
    const review = vi.fn()
      .mockResolvedValueOnce({ ok: false, stale: true, error: "Reload before saving." })
      .mockResolvedValueOnce({ ok: true, message: "Application shortlisted." });
    const { rerender } = render(<CreatorApplicationDetail application={application()} review={review} />);

    await user.selectOptions(screen.getByLabelText("Status"), "shortlisted");
    await user.type(screen.getByLabelText("Internal notes"), "Local stale draft.");
    await user.click(screen.getByRole("button", { name: "Save review" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reload application" }));
    expect(refresh).toHaveBeenCalled();

    rerender(<CreatorApplicationDetail application={application({
      status: "shortlisted",
      revision: 1,
      internal_notes: "Other reviewer notes.",
      reviewer_email: "other@example.test",
    })} review={review} />);

    expect(screen.getByLabelText("Status")).toHaveValue("shortlisted");
    expect(screen.getByLabelText("Internal notes")).toHaveValue("Other reviewer notes.");
    expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save review" }));
    expect(review.mock.calls[1][0]).toMatchObject({ expectedRevision: 1, notes: "Other reviewer notes." });
  });
});
