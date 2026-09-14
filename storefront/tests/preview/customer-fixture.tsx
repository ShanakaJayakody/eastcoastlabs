import { useEffect, useState } from "react";
import CustomerDetails from "@/components/admin/CustomerDetails";
import type { CustomerContact } from "@/lib/admin/customer-details";

export default function CustomerFixture() {
  const [customer, setCustomer] = useState<CustomerContact>({ email: "taylor@example.test", name: "Taylor Example", phone: "0400 123 456", address: { line1: "12 Example Street", suburb: "Melbourne", state: "VIC", postcode: "3000", country: "AU" }, version: 0 });
  useEffect(() => {
    const saved = (event: Event) => setCustomer((event as CustomEvent<CustomerContact>).detail);
    window.addEventListener("preview:customer-saved", saved);
    return () => window.removeEventListener("preview:customer-saved", saved);
  }, []);
  return <div className="space-y-6"><h1 className="text-xs uppercase tracking-wide text-muted">Customers</h1><h2 className="text-xl font-semibold">{customer.name}</h2><CustomerDetails customer={customer} /></div>;
}
