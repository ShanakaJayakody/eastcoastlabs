import { expect, it } from "vitest";
import { customerContact } from "@/lib/admin/customer-details";

it("prefills legacy checkout addresses and allows saved blank fields to override order snapshots", () => {
  const order = { customer_name: "Latest Name", shipping_address: { line1: "1 Street", city: "Geelong", phone: "0400123456" } };
  expect(customerContact("buyer@example.test", null, order)).toMatchObject({ name: "Latest Name", phone: "0400123456", address: { suburb: "Geelong", line1: "1 Street" }, version: 0 });
  expect(customerContact("buyer@example.test", { name: null, phone: null, address: {}, edit_version: 1 }, order)).toEqual({ email: "buyer@example.test", name: null, phone: null, address: {}, version: 1 });
});
