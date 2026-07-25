import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Ticket,
  FlaskConical,
  Star,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which build phase ships the real screen (Phase A only wires Dashboard). */
  phase?: string;
}

/** Single source of truth for the sidebar and the ⌘K command palette. */
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Discounts", href: "/admin/discounts", icon: Ticket, phase: "Phase E" },
  { label: "COAs", href: "/admin/coas", icon: FlaskConical, phase: "Phase E" },
  { label: "Reviews", href: "/admin/reviews", icon: Star, phase: "Phase E" },
  { label: "Settings", href: "/admin/settings", icon: Settings, phase: "Phase E" },
];
