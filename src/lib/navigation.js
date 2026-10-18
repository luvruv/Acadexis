const DASHBOARD = { href: "/dashboard", label: "Dashboard" };

const NAV_BY_ROLE = {
  ADMIN: [DASHBOARD, { href: "/admin/program", label: "Program setup" }],
  COORDINATOR: [DASHBOARD, { href: "/coordinator", label: "My course files" }],
  CO_TEACHER: [DASHBOARD, { href: "/teacher", label: "My assignments" }],
};

export function getNavItems(role) {
  return NAV_BY_ROLE[role] ?? [DASHBOARD];
}