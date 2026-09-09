// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const trackCreatorEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ trackCreatorEvent }));

import CreatorApplicationForm from "@/components/creators/CreatorApplicationForm";
import type { ApplyResult, CreatorInput } from "@/lib/creators/types";

const pitch =
  "I create polished short-form creator stories with careful light, product detail and a clear point of view.";

function continueButton() {
  return screen.getByRole("button", { name: /^Continue$/ });
}

async function textStep(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  await user.type(screen.getByLabelText(label, { exact: true }), value);
  await user.click(continueButton());
}

async function chooseStep(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("radio", { name: label }));
  await user.click(continueButton());
}

async function confirmEligibility(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("I am 18 or over and based in Australia."));
  await user.click(screen.getByLabelText(/I agree that ECL may review my application/));
  await user.click(continueButton());
}

async function fillRequiredToReview(user: ReturnType<typeof userEvent.setup>) {
  await textStep(user, "Full name", "Taylor Example");
  await textStep(user, "Email address", "taylor@example.test");
  await textStep(user, "Phone number", "0412 345 678");
  await textStep(user, "Primary social profile", "https://instagram.com/taylor.example/");
  await user.click(screen.getByRole("button", { name: "Skip for now" }));
  await chooseStep(user, "Video");
  await chooseStep(user, "Biohacking");
  await chooseStep(user, "VIC");
  await textStep(user, "Tell us about your audience and content", pitch);
  await textStep(user, "Audience size", "1200");
  await confirmEligibility(user);
  await screen.findByRole("heading", { name: "Review your application" });
}

async function fillToEligibility(user: ReturnType<typeof userEvent.setup>) {
  await textStep(user, "Full name", "Taylor Example");
  await textStep(user, "Email address", "taylor@example.test");
  await textStep(user, "Phone number", "0412 345 678");
  await textStep(user, "Primary social profile", "https://instagram.com/taylor.example/");
  await user.click(screen.getByRole("button", { name: "Skip for now" }));
  await chooseStep(user, "Video");
  await chooseStep(user, "Biohacking");
  await chooseStep(user, "VIC");
  await textStep(user, "Tell us about your audience and content", pitch);
  await textStep(user, "Audience size", "1200");
}

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

  it("validates the active visible step with the shared creator validator", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    expect(screen.getByLabelText("Full name", { exact: true })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email address", { exact: true })).toBeNull();

    await user.click(continueButton());

    const name = screen.getByRole("textbox", { name: "Full name" });
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Full name is too short.");
  });

  it("advances one question at a time and keeps values when going back", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    await user.type(screen.getByLabelText("Full name", { exact: true }), "Taylor Example");
    await user.keyboard("{Enter}");

    expect(screen.getByLabelText("Email address", { exact: true })).toBeInTheDocument();
    expect(screen.queryByLabelText("Full name", { exact: true })).toBeNull();

    await user.type(screen.getByLabelText("Email address", { exact: true }), "taylor@example.test");
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByLabelText("Full name", { exact: true })).toHaveValue("Taylor Example");
  });

  it("lets the optional portfolio step be skipped while requiring audience size", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    await fillRequiredToReview(user);

    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    expect(screen.getByText("Not shared")).toBeInTheDocument();
    expect(screen.getByText("Audience size")).toBeInTheDocument();
    expect(screen.getByText("1200")).toBeInTheDocument();
  });

  it("requires a valid phone number before the social profile step", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    await textStep(user, "Full name", "Taylor Example");
    await textStep(user, "Email address", "taylor@example.test");
    await user.click(continueButton());

    const phone = screen.getByRole("textbox", { name: "Phone number" });
    await waitFor(() => expect(phone).toHaveFocus());
    expect(phone).toHaveAttribute("aria-invalid", "true");

    await user.type(phone, "abc");
    await user.click(continueButton());
    await waitFor(() => expect(phone).toHaveFocus());
    expect(phone).toHaveAttribute("aria-invalid", "true");

    await user.clear(phone);
    await user.type(phone, "0412 345 678");
    await user.click(continueButton());
    expect(screen.getByLabelText("Primary social profile", { exact: true })).toBeInTheDocument();
  });

  it("keeps choice questions native and waits for Continue after keyboard changes", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    await textStep(user, "Full name", "Taylor Example");
    await textStep(user, "Email address", "taylor@example.test");
    await textStep(user, "Phone number", "0412 345 678");
    await textStep(user, "Primary social profile", "https://instagram.com/taylor.example/");
    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    const video = screen.getByRole("radio", { name: "Video" });
    await user.click(video);
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: "Video" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Biohacking" })).toBeNull();

    await user.click(continueButton());
    expect(screen.getByRole("radio", { name: "Biohacking" })).toBeInTheDocument();
  });

  it("keeps textarea Enter as a newline instead of advancing", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    await textStep(user, "Full name", "Taylor Example");
    await textStep(user, "Email address", "taylor@example.test");
    await textStep(user, "Phone number", "0412 345 678");
    await textStep(user, "Primary social profile", "https://instagram.com/taylor.example/");
    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    await chooseStep(user, "Video");
    await chooseStep(user, "Biohacking");
    await chooseStep(user, "VIC");

    await user.type(
      screen.getByLabelText("Tell us about your audience and content", { exact: true }),
      "Line one{Enter}Line two with enough creator detail to pass later.",
    );

    expect(screen.getByLabelText("Tell us about your audience and content", { exact: true })).toHaveValue(
      "Line one\nLine two with enough creator detail to pass later.",
    );
    expect(screen.queryByRole("textbox", { name: "Audience size" })).toBeNull();
  });

  it("requires Other focus detail and clears it when a different focus is selected", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({ ok: true });
    render(<CreatorApplicationForm submit={submit} />);

    await textStep(user, "Full name", "Taylor Example");
    await textStep(user, "Email address", "taylor@example.test");
    await textStep(user, "Phone number", "0412 345 678");
    await textStep(user, "Primary social profile", "https://instagram.com/taylor.example/");
    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    await chooseStep(user, "Video");

    await user.click(screen.getByRole("radio", { name: "Other" }));
    const detail = screen.getByRole("textbox", { name: "Tell us what you love talking about" });
    expect(detail).toBeInTheDocument();
    await user.click(continueButton());
    await waitFor(() => expect(detail).toHaveFocus());
    expect(detail).toHaveAttribute("aria-invalid", "true");

    await user.type(detail, "Recovery routines");
    await user.click(continueButton());
    await chooseStep(user, "VIC");
    await textStep(user, "Tell us about your audience and content", pitch);
    await textStep(user, "Audience size", "1200");
    await confirmEligibility(user);
    await screen.findByRole("heading", { name: "Review your application" });
    expect(screen.getByText("Other: Recovery routines")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Content focus" }));
    await user.click(screen.getByRole("radio", { name: "Fitness" }));
    expect(screen.queryByRole("textbox", { name: "Tell us what you love talking about" })).toBeNull();
    await user.click(continueButton());
    await screen.findByRole("heading", { name: "Review your application" });
    expect(screen.queryByText(/Recovery routines/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /Send my application/ }));
    await screen.findByRole("status");
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ focus: "fitness", focusDetail: "" }),
      "30000000-0000-0000-0000-000000000001",
    );
  });

  it("requires an exact whole-number audience size and accepts zero", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    await textStep(user, "Full name", "Taylor Example");
    await textStep(user, "Email address", "taylor@example.test");
    await textStep(user, "Phone number", "0412 345 678");
    await textStep(user, "Primary social profile", "https://instagram.com/taylor.example/");
    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    await chooseStep(user, "Video");
    await chooseStep(user, "Biohacking");
    await chooseStep(user, "VIC");
    await textStep(user, "Tell us about your audience and content", pitch);

    await user.click(continueButton());
    const audience = screen.getByRole("textbox", { name: "Audience size" });
    await waitFor(() => expect(audience).toHaveFocus());
    expect(audience).toHaveAttribute("aria-invalid", "true");

    await user.type(audience, "-1");
    await user.click(continueButton());
    expect(audience).toHaveAttribute("aria-invalid", "true");

    await user.clear(audience);
    await user.type(audience, "1.5");
    await user.click(continueButton());
    expect(audience).toHaveAttribute("aria-invalid", "true");

    await user.clear(audience);
    await user.type(audience, "0");
    await user.click(continueButton());
    await confirmEligibility(user);
    await screen.findByRole("heading", { name: "Review your application" });
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("does not advance when WebKit reports a composing Enter key", () => {
    render(<CreatorApplicationForm submit={vi.fn()} />);

    const name = screen.getByLabelText("Full name", { exact: true });
    fireEvent.keyDown(name, { key: "Enter", keyCode: 229 });

    expect(screen.getByLabelText("Full name", { exact: true })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email address", { exact: true })).toBeNull();
  });

  it("opens the creator privacy notice in a new tab from the consent step", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    await fillToEligibility(user);

    const link = screen.getByRole("link", { name: /Creator Privacy Notice.*opens in a new tab/ });
    expect(link).toHaveAttribute("href", "/creators/privacy");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("requires a review before explicit submission and sends edited details", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({ ok: true });
    render(<CreatorApplicationForm submit={submit} />);

    await fillRequiredToReview(user);
    expect(submit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Edit Phone number" }));
    const phone = screen.getByLabelText("Phone number", { exact: true });
    await user.clear(phone);
    await user.type(phone, "+61 499 111 222");
    await user.click(continueButton());
    await screen.findByRole("heading", { name: "Review your application" });

    await user.click(screen.getByRole("button", { name: "Edit Audience size" }));
    const audience = screen.getByLabelText("Audience size", { exact: true });
    await user.clear(audience);
    await user.type(audience, "2500");
    await user.click(continueButton());
    await screen.findByRole("heading", { name: "Review your application" });
    await user.click(screen.getByRole("button", { name: /Send my application/ }));

    await screen.findByRole("status");
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+61499111222", audienceSize: 2500 }),
      "30000000-0000-0000-0000-000000000001",
    );
  });

  it("focuses the review heading when first arriving and when returning from an edit", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    await fillRequiredToReview(user);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Review your application" })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Edit Email address" }));
    const email = screen.getByLabelText("Email address", { exact: true });
    await user.clear(email);
    await user.type(email, "casey@example.test");
    await user.click(continueButton());

    await waitFor(() => expect(screen.getByRole("heading", { name: "Review your application" })).toHaveFocus());
  });

  it("focuses the selected radio when editing a choice from review", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn()} />);

    await fillRequiredToReview(user);
    await user.click(screen.getByRole("button", { name: "Edit State/territory" }));

    await waitFor(() => expect(screen.getByRole("radio", { name: "VIC" })).toHaveFocus());
    expect(screen.getByRole("radio", { name: "VIC" })).toBeChecked();
  });

  it("prevents duplicate pending submissions and locks review controls", async () => {
    const user = userEvent.setup();
    let release!: (value: ApplyResult) => void;
    const submit = vi.fn(
      (_input: CreatorInput, _key: string) =>
        new Promise<ApplyResult>((resolve) => {
          release = resolve;
        }),
    );
    render(<CreatorApplicationForm submit={submit} />);
    await fillRequiredToReview(user);

    const button = screen.getByRole("button", { name: /Send my application/ });
    await user.click(button);
    await user.click(button);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Sending application/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit Email address" })).toBeDisabled();
    release({ ok: true });
    await screen.findByRole("status");
  });

  it("reuses the idempotency key for uncertain retries and creates a new key after edits", async () => {
    const user = userEvent.setup();
    vi.mocked(crypto.randomUUID)
      .mockReturnValueOnce("30000000-0000-0000-0000-000000000001")
      .mockReturnValueOnce("30000000-0000-0000-0000-000000000002");
    const submit = vi.fn()
      .mockRejectedValueOnce(new Error("network uncertain"))
      .mockResolvedValueOnce({ ok: false, code: "unavailable" })
      .mockResolvedValueOnce({ ok: true });
    render(<CreatorApplicationForm submit={submit} />);
    await fillRequiredToReview(user);

    await user.click(screen.getByRole("button", { name: /Send my application/ }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /Send my application/ }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Edit Full name" }));
    const name = screen.getByLabelText("Full name", { exact: true });
    await user.clear(name);
    await user.type(name, "Casey Example");
    await user.click(continueButton());
    await screen.findByRole("heading", { name: "Review your application" });
    await user.click(screen.getByRole("button", { name: /Send my application/ }));
    await screen.findByRole("status");

    expect(submit.mock.calls.map((call) => call[1])).toEqual([
      "30000000-0000-0000-0000-000000000001",
      "30000000-0000-0000-0000-000000000001",
      "30000000-0000-0000-0000-000000000002",
    ]);
    expect(submit.mock.calls[2][0]).toEqual(expect.objectContaining({ name: "Casey Example" }));
    expect(JSON.stringify(sessionStorage)).not.toMatch(/taylor|casey|instagram|polished short-form/);
  });

  it("jumps to the matching step and focuses the field after server validation errors", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({
      ok: false,
      code: "validation",
      fieldErrors: { phone: "Synthetic creator phone needs correction." },
    });
    render(<CreatorApplicationForm submit={submit} />);
    await fillRequiredToReview(user);

    await user.click(screen.getByRole("button", { name: /Send my application/ }));

    const phone = await screen.findByLabelText("Phone number", { exact: true });
    await waitFor(() => expect(phone).toHaveFocus());
    expect(phone).toHaveAccessibleDescription(/Synthetic creator phone needs correction\./);
  });

  it("replaces the form with a focusable confirmation after success", async () => {
    const user = userEvent.setup();
    render(<CreatorApplicationForm submit={vi.fn().mockResolvedValue({ ok: true })} />);
    await fillRequiredToReview(user);
    await user.click(screen.getByRole("button", { name: /Send my application/ }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Your application is in.");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your application is in." })).toHaveFocus());
    expect(screen.queryByRole("button", { name: /Send my application/ })).toBeNull();
    expect(trackCreatorEvent.mock.calls.filter((call) => call[0] === "creator_application_start")).toHaveLength(1);
    expect(trackCreatorEvent).toHaveBeenCalledWith("creator_application_submit");
    expect(JSON.stringify(trackCreatorEvent.mock.calls)).not.toMatch(/taylor@example|instagram|polished short-form/);
  });
});
