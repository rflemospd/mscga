export type Role = 'viewer' | 'ops' | 'admin';

const roleRank: Record<Role, number> = {
  viewer: 1,
  ops: 2,
  admin: 3,
};

export const routeRequirements: Record<string, Role> = {
  '/home': 'viewer',
  '/info': 'viewer',
  '/restricted': 'ops',
  '/admin': 'admin',
};

export const cardPermissions: Record<Role, string[]> = {
  viewer: ['status', 'news'],
  ops: ['status', 'news', 'operations'],
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
