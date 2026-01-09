import { currentUser } from '@clerk/nextjs/server';
import { getUserByClerkId, getTenantMember, createOrUpdateUser } from '@/lib/db/queries';
import type { UserRole } from '@/lib/db/types';

export interface AuthContext {
  userId: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface TenantAuthContext extends AuthContext {
  tenantId: string;
  role: UserRole;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    return null;
  }

  let user = await getUserByClerkId(clerkUser.id);

  if (!user) {
    user = await createOrUpdateUser(
      clerkUser.id,
      email,
      clerkUser.firstName,
      clerkUser.lastName,
      clerkUser.imageUrl
    );
  }

  return {
    userId: user.id,
    clerkUserId: clerkUser.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
  };
}

export async function getTenantAuthContext(tenantId: string): Promise<TenantAuthContext | null> {
  const authContext = await getAuthContext();

  if (!authContext) {
    return null;
  }

  const membership = await getTenantMember(tenantId, authContext.userId);

  if (!membership) {
    return null;
  }

  return {
    ...authContext,
    tenantId,
    role: membership.role,
  };
}

export function requireAuth(authContext: AuthContext | null): AuthContext {
  if (!authContext) {
    throw new Error('Unauthorized');
  }
  return authContext;
}

export function requireTenantAuth(tenantAuthContext: TenantAuthContext | null): TenantAuthContext {
  if (!tenantAuthContext) {
    throw new Error('Unauthorized or not a member of this tenant');
  }
  return tenantAuthContext;
}
