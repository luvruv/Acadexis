const DASHBOARD = { href: "/dashboard", label: "Dashboard" };

const NAV_BY_ROLE = {
  ADMIN: [
    DASHBOARD,
    { href: "/admin/program", label: "Program setup" },
    { href: "/admin/outcomes", label: "PEOs / POs / PSOs" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/audit", label: "Audit log" },
    { href: "/repository", label: "Repository" },
  ],
  COORDINATOR: [
    DASHBOARD,
    { href: "/coordinator", label: "My course files" },
    { href: "/repository", label: "Repository" },
  ],
  CO_TEACHER: [DASHBOARD, { href: "/teacher", label: "My assignments" }],
};

export function getNavItems(role) {
  return NAV_BY_ROLE[role] ?? [DASHBOARD];
}