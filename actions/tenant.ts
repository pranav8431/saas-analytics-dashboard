'use server';

import { revalidatePath } from 'next/cache';
import { createTenant, getTenantBySlug, getUserTenants } from '@/lib/db/queries';
import { getAuthContext, requireAuth } from '@/lib/auth/context';

export async function createTenantAction(name: string, slug: string) {
  try {
    const authContext = await getAuthContext();
    requireAuth(authContext);

    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(slug)) {
      return {
        success: false,
        error: 'Slug must contain only lowercase letters, numbers, and hyphens',
      };
    }

    const existing = await getTenantBySlug(slug);
    if (existing) {
      return {
        success: false,
        error: 'This slug is already taken',
      };
    }

    const tenant = await createTenant(name, slug, authContext!.userId);

    revalidatePath('/dashboard');

    return {
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    };
  } catch (error) {
    console.error('Error creating tenant:', error);
    return {
      success: false,
      error: 'Failed to create organization',
    };
  }
}

export async function getUserTenantsAction() {
  try {
    const authContext = await getAuthContext();
    requireAuth(authContext);

    const tenants = await getUserTenants(authContext!.userId);

    return {
      success: true,
      tenants,
    };
  } catch (error) {
    console.error('Error fetching user tenants:', error);
    return {
      success: false,
      error: 'Failed to fetch organizations',
      tenants: [],
    };
  }
}
