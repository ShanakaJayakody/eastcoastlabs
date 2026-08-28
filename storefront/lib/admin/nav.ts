import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Ticket,
  FlaskConical,
  Star,
  Settings,
  Sparkles,
  Mail,
  LifeBuoy,
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
  { label: "Pipeline", href: "/admin/pipeline", icon: Sparkles },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Recovery", href: "/admin/recovery", icon: LifeBuoy },
  { label: "Discounts", href: "/admin/discounts", icon: Ticket },
  { label: "COAs", href: "/admin/coas", icon: FlaskConical },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Emails", href: "/admin/email-templates", icon: Mail },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
