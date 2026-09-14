// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const { save, replace, refresh } = vi.hoisted(() => ({ save: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/(dashboard)/customers/profile-actions", () => ({ saveCustomerDetails: save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
import CustomerDetails from "@/components/admin/CustomerDetails";
const customer = { email: "buyer@example.test", name: "Original Name", phone: "0400000000", address: { line1: "10 Street", suburb: "Melbourne", state: "VIC", postcode: "3000", country: "AU" }, version: 0 };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });

it("keeps drafts after refresh and failure, then navigates to the saved email", async () => {
  const { rerender } = render(<CustomerDetails customer={customer} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "correct@example.test" } });
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Correct Name" } });
  rerender(<CustomerDetails customer={{ ...customer, name: "Another editor" }} />);
  expect(screen.getByLabelText("Name")).toHaveValue("Correct Name");
  save.mockResolvedValueOnce({ ok: false, message: "Email already in use" });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Email already in use");
  expect(screen.getByLabelText("Email")).toHaveValue("correct@example.test");
  expect(replace).not.toHaveBeenCalled();
  save.mockResolvedValueOnce({ ok: true, message: "Customer details saved.", email: "correct@example.test", version: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/customers/correct%40example.test"));
  expect(save).toHaveBeenLastCalledWith("buyer@example.test", { email: "correct@example.test", name: "Correct Name", phone: "0400000000", address: { line1: "10 Street", line2: "", suburb: "Melbourne", state: "VIC", postcode: "3000", country: "AU" } }, 0);
});

it("cancels without saving and preserves input when the network fails", async () => {
  render(<CustomerDetails customer={customer} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "12345" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
  expect(screen.getByLabelText("Phone")).toHaveValue("0400000000");
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "12345" } });
  save.mockRejectedValueOnce(new Error("Connection lost"));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
  expect(screen.getByLabelText("Phone")).toHaveValue("12345");
});
