import type { UserRole } from '@/lib/db/types';

export const PERMISSIONS = {
  VIEW_ANALYTICS: 'view_analytics',
  UPLOAD_FILES: 'upload_files',
  DELETE_FILES: 'delete_files',
  MANAGE_MEMBERS: 'manage_members',
  MANAGE_TENANT: 'manage_tenant',
  ACKNOWLEDGE_ANOMALIES: 'acknowledge_anomalies',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.DELETE_FILES,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.MANAGE_TENANT,
    PERMISSIONS.ACKNOWLEDGE_ANOMALIES,
  ],
  ADMIN: [
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.DELETE_FILES,
    PERMISSIONS.ACKNOWLEDGE_ANOMALIES,
  ],
  MEMBER: [PERMISSIONS.VIEW_ANALYTICS],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

export function canUploadFiles(role: UserRole): boolean {
  return hasPermission(role, PERMISSIONS.UPLOAD_FILES);
}

export function canDeleteFiles(role: UserRole): boolean {
  return hasPermission(role, PERMISSIONS.DELETE_FILES);
}

export function canManageMembers(role: UserRole): boolean {
  return hasPermission(role, PERMISSIONS.MANAGE_MEMBERS);
}

export function canManageTenant(role: UserRole): boolean {
  return hasPermission(role, PERMISSIONS.MANAGE_TENANT);
}

export function canAcknowledgeAnomalies(role: UserRole): boolean {
  return hasPermission(role, PERMISSIONS.ACKNOWLEDGE_ANOMALIES);
}
