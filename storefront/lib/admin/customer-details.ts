export interface CustomerAddress {
  line1?: string;
  line2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface CustomerDetailsInput {
  email: string;
  name: string;
  phone: string;
  address: CustomerAddress;
}

export interface CustomerContact {
  email: string;
  name: string | null;
  phone: string | null;
  address: CustomerAddress;
  version: number;
}

export interface CustomerProfile {
  name: string | null;
  phone: string | null;
  address: CustomerAddress;
  edit_version: number;
  previous_emails?: string[];
  tags?: string[];
}

export function customerContact(email: string, profile: CustomerProfile | null, latestOrder?: {
  customer_name: string | null;
  shipping_address: Record<string, string | null> | null;
}): CustomerContact {
  if (profile && profile.edit_version > 0) {
    return { email, name: profile.name, phone: profile.phone, address: profile.address, version: profile.edit_version };
  }
  const address = latestOrder?.shipping_address ?? {};
  return {
    email, name: latestOrder?.customer_name ?? null, phone: address.phone ?? null, version: 0,
    address: {
      line1: address.line1 ?? "", line2: address.line2 ?? "", suburb: address.suburb?.trim() || address.city || "",
      state: address.state ?? "", postcode: address.postcode ?? "", country: address.country ?? "",
    },
  };
}

export function parseCustomerDetails(input: unknown): CustomerDetailsInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).some(key => !["email", "name", "phone", "address"].includes(key))) return null;
  if (typeof fields.email !== "string" || typeof fields.name !== "string" || typeof fields.phone !== "string") return null;
  const email = fields.email.trim().toLowerCase();
  const name = fields.name.trim();
  const phone = fields.phone.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length > 300 || phone.length > 50) return null;
  if (!fields.address || typeof fields.address !== "object" || Array.isArray(fields.address)) return null;
  const address: CustomerAddress = {};
  for (const [key, value] of Object.entries(fields.address)) {
    if (!["line1", "line2", "suburb", "state", "postcode", "country"].includes(key) || typeof value !== "string" || value.length > 300) return null;
    address[key as keyof CustomerAddress] = value.trim();
  }
  return { email, name, phone, address };
}
