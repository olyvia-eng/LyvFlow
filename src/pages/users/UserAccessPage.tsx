import { useMemo, useState } from 'react';
import { PageHeader, Card, Input, Select, Button, Badge } from '../../components/ui';
import type { BusinessUserRole, BusinessUserSummary } from '../../auth/types';

interface UserAccessPageProps {
  users: BusinessUserSummary[];
  currentUserRole: BusinessUserRole;
  onCreateUser: (payload: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'employee';
  }) => Promise<{ ok: boolean; error?: string }>;
}

const roleLabel: Record<BusinessUserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  employee: 'Employee',
};

const roleColor: Record<BusinessUserRole, string> = {
  owner: 'bg-indigo-100 text-indigo-700',
  admin: 'bg-blue-100 text-blue-700',
  employee: 'bg-emerald-100 text-emerald-700',
};

export default function UserAccessPage({ users, currentUserRole, onCreateUser }: UserAccessPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<BusinessUserRole>('employee');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreateAdmins = useMemo(
    () => currentUserRole === 'owner' || currentUserRole === 'admin',
    [currentUserRole]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please complete all fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (role === 'owner') {
      setError('Use business signup to create a new owner account.');
      return;
    }

    if (role === 'admin' && !canCreateAdmins) {
      setError('You do not have permission to create admin users.');
      return;
    }

    setSubmitting(true);
    const result = await onCreateUser({
      name,
      email,
      password,
      role,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not create user.');
      return;
    }

    setName('');
    setEmail('');
    setPassword('');
    setRole('employee');
    setSuccess('User created successfully.');
  };

  return (
    <div>
      <PageHeader
        title="User Access"
        subtitle="Create and manage employee or secondary admin logins for your business."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-4 xl:col-span-1">
          <h2 className="font-semibold text-gray-800 mb-3">Add User</h2>
          <form onSubmit={submit} className="space-y-3">
            <Input label="Full Name" value={name} onChange={(event) => setName(event.target.value)} />
            <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input
              label="Temporary Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Select
              label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value as BusinessUserRole)}
            >
              <option value="employee">Employee</option>
              <option value="admin" disabled={!canCreateAdmins}>Secondary Admin</option>
            </Select>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <Button type="submit" className="w-full justify-center">
              {submitting ? 'Creating user...' : 'Create User'}
            </Button>
          </form>
        </Card>

        <Card className="xl:col-span-2 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Business Users</h2>
          </div>
          {users.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500 text-left text-xs">
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="py-2 font-medium">Email</th>
                    <th className="py-2 font-medium">Role</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{user.name}</td>
                      <td className="py-2 text-gray-600">{user.email}</td>
                      <td className="py-2">
                        <Badge label={roleLabel[user.role]} className={roleColor[user.role]} />
                      </td>
                      <td className="py-2 text-gray-600">{user.active ? 'Active' : 'Inactive'}</td>
                      <td className="py-2 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
