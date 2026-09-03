import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Ticket,
  FlaskConical,
  Star,
  Settings,
  ScrollText,
  BarChart3,
  Sparkles,
  Mail,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

/**
 * Sidebar groups, in the order an operator's day runs: the work first, then the
 * things the work is made of, then the people, then growth, then the machinery.
 * Twelve flat items had become a list you scan rather than a map you know.
 */
export type NavGroup = "Today" | "Catalogue" | "People" | "Growth" | "System";

export const NAV_GROUPS: NavGroup[] = ["Today", "Catalogue", "People", "Growth", "System"];

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Which build phase ships the real screen (Phase A only wires Dashboard). */
  phase?: string;
}

/** Single source of truth for the sidebar and the ⌘K command palette. */
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, group: "Today" },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart, group: "Today" },
  { label: "Products", href: "/admin/products", icon: Package, group: "Catalogue" },
  { label: "Pipeline", href: "/admin/pipeline", icon: Sparkles, group: "Catalogue" },
  { label: "COAs", href: "/admin/coas", icon: FlaskConical, group: "Catalogue" },
  { label: "Customers", href: "/admin/customers", icon: Users, group: "People" },
  { label: "Recovery", href: "/admin/recovery", icon: LifeBuoy, group: "People" },
  { label: "Reviews", href: "/admin/reviews", icon: Star, group: "People" },
  { label: "Discounts", href: "/admin/discounts", icon: Ticket, group: "Growth" },
  { label: "Emails", href: "/admin/email-templates", icon: Mail, group: "Growth" },
  { label: "Reports", href: "/admin/reports", icon: BarChart3, group: "Growth" },
  { label: "Audit", href: "/admin/audit", icon: ScrollText, group: "System" },
  { label: "Settings", href: "/admin/settings", icon: Settings, group: "System" },
];
