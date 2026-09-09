// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const trackCreatorEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ trackCreatorEvent }));

import CreatorApplicationForm from "@/components/creators/CreatorApplicationForm";
import type { ApplyResult, CreatorInput } from "@/lib/creators/types";

const valid = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("Full name"), "Taylor Example");
  await user.type(screen.getByLabelText("Email address"), "taylor@example.test");
  await user.type(screen.getByLabelText("Primary social profile"), "https://instagram.com/taylor.example/");
  await user.selectOptions(screen.getByLabelText("Main discipline"), "video");
  await user.selectOptions(screen.getByLabelText("Your content focus"), "health");
  await user.selectOptions(screen.getByLabelText("Australian state/territory"), "VIC");
  await user.type(
    screen.getByLabelText("Tell us about your audience and content"),
    "I create thoughtful short-form product stories with natural light, careful pacing and a clear point of view.",
  );
  await user.click(screen.getByLabelText("I am 18 or over and based in Australia."));
  await user.click(screen.getByLabelText(/I agree that ECL may review my application/));
};

describe("CreatorApplicationForm", () => {
  beforeEach(() => {
    sessionStorage.clear();
    trackCreatorEvent.mockClear();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("30000000-0000-0000-0000-000000000001");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("focuses the first invalid field and describes field errors", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Send my application/ }));
  const name = screen.getByRole("textbox", { name: "Full name" });
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Full name is too short.");
  });

  it("prevents duplicate pending submissions", async () => {
    const user = userEvent.setup();
    let release!: (value: ApplyResult) => void;
    const submit = vi.fn(
      (_input: CreatorInput, _key: string) =>
        new Promise<ApplyResult>((resolve) => {
          release = resolve;
        }),
    );
    render(<CreatorApplicationForm submit={submit} />);
    await valid(user);
    const button = screen.getByRole("button", { name: /Send my application/ });
    await user.click(button);
    await user.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    release({ ok: true });
    await screen.findByRole("status");
  });

  it("locks editable fields while an application is pending", async () => {
    const user = userEvent.setup();
    let release!: (value: ApplyResult) => void;
    const submit = vi.fn(
      (_input: CreatorInput, _key: string) =>
        new Promise<ApplyResult>((resolve) => {
          release = resolve;
        }),
    );
    render(<CreatorApplicationForm submit={submit} />);
    await valid(user);
    const email = screen.getByLabelText("Email address");
    await user.click(screen.getByRole("button", { name: /Send my application/ }));
    expect(email).toBeDisabled();
    expect(email).toHaveValue("taylor@example.test");
    release({ ok: true });
    await screen.findByRole("status");
  });

  it("preserves inputs after a recoverable server error", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({ ok: false, code: "unavailable" });
    render(<CreatorApplicationForm submit={submit} />);
    await valid(user);
    await user.click(screen.getByRole("button", { name: /Send my application/ }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Email address")).toHaveValue("taylor@example.test");
    expect(screen.getByLabelText("Tell us about your audience and content")).toHaveValue(
      "I create thoughtful short-form product stories with natural light, careful pacing and a clear point of view.",
    );
    expect(trackCreatorEvent).toHaveBeenCalledWith("creator_application_error", { errorCode: "unavailable" });
  });

  it("replaces the form with a focusable confirmation after success", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn().mockResolvedValue({ ok: true })} />);
    await valid(user);
    await user.click(screen.getByRole("button", { name: /Send my application/ }));
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Your application is in.");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your application is in." })).toHaveFocus());
    expect(screen.queryByRole("button", { name: /Send my application/ })).toBeNull();
    expect(trackCreatorEvent.mock.calls.filter((call) => call[0] === "creator_application_start")).toHaveLength(1);
    expect(trackCreatorEvent).toHaveBeenCalledWith("creator_application_submit");
    expect(JSON.stringify(trackCreatorEvent.mock.calls)).not.toMatch(/taylor@example|instagram|thoughtful short-form/);
  });

  it("reuses the same idempotency key after an uncertain transport failure", async () => {
    const user = userEvent.setup();
    const submit = vi.fn()
      .mockRejectedValueOnce(new Error("network uncertain"))
      .mockResolvedValueOnce({ ok: true });
    render(<CreatorApplicationForm submit={submit} />);
    await valid(user);
    await user.click(screen.getByRole("button", { name: /Send my application/ }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /Send my application/ }));
    await screen.findByRole("status");
    expect(submit.mock.calls.map((call) => call[1])).toEqual([
      "30000000-0000-0000-0000-000000000001",
      "30000000-0000-0000-0000-000000000001",
    ]);
    expect(JSON.stringify(sessionStorage)).not.toContain("taylor@example.test");
  });
});
