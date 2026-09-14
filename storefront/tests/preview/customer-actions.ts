import type { CustomerDetailsInput } from "@/lib/admin/customer-details";

export async function saveCustomerDetails(_email: string, details: CustomerDetailsInput, version: number) {
  if (new URLSearchParams(window.location.search).get("save") === "error") {
    return { ok: false as const, message: "This email is already in use by another customer record." };
  }
  window.dispatchEvent(new CustomEvent("preview:customer-saved", { detail: { ...details, version: version + 1 } }));
  return { ok: true as const, message: "Customer details saved.", email: details.email, version: version + 1 };
}
