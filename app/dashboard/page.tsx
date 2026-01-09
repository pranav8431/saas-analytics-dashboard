import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthContext, requireAuth } from '@/lib/auth/context';
import { getUserTenants } from '@/lib/db/queries';
import { UserButton } from '@clerk/nextjs';

export default async function DashboardIndexPage() {
  const authContext = await getAuthContext();
  requireAuth(authContext);

  const tenants = await getUserTenants(authContext!.userId);

  if (tenants.length === 1) {
    redirect(`/dashboard/${tenants[0].tenant_id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-xl font-bold text-blue-600">AnalyticsSaaS</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Organizations</h1>
          <p className="text-gray-600 mt-2">Select an organization to view its analytics</p>
        </div>

        {tenants.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No organizations yet
            </h2>
            <p className="text-gray-600 mb-6">Create your first organization to get started</p>
            <Link
              href="/onboarding"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Organization
            </Link>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenants.map((tenant: any) => (
                <Link
                  key={tenant.id}
                  href={`/dashboard/${tenant.tenant_id}`}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {tenant.tenant_name}
                    </h3>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {tenant.role}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">View analytics dashboard</p>
                </Link>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href="/onboarding"
                className="inline-block bg-white border-2 border-blue-600 text-blue-600 px-6 py-3 rounded-md hover:bg-blue-50 transition-colors"
              >
                Create New Organization
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
