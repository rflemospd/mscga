export type Role = 'grandes_contas' | 'farma' | 'admin';

const roleRank: Record<Role, number> = {
  grandes_contas: 1,
  farma: 2,
  admin: 3,
};

export const routeRequirements: Record<string, Role> = {
  '/home': 'grandes_contas',
  '/info': 'grandes_contas',
  '/farma': 'farma',
  '/restricted': 'farma',
  '/admin': 'admin',
};

export const cardPermissions: Record<Role, string[]> = {
  grandes_contas: ['status', 'news'],
  farma: ['status', 'news', 'operations'],
  admin: ['status', 'news', 'operations', 'adminGuide'],
};

export function hasRoleAccess(current: Role, required: Role): boolean {
  return roleRank[current] >= roleRank[required];
}

export function hasAccessToRoute(role: Role, route: string): boolean {
  const required = routeRequirements[route];
  if (!required) return false;
  return hasRoleAccess(role, required);
}
