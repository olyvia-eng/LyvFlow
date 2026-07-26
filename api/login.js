export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return res.status(500).json({ ok: false, error: 'Server auth env vars are not configured' });
  }

  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Invalid payload' });
  }

  const isValid =
    username.trim().toLowerCase() === adminUsername.trim().toLowerCase() &&
    password === adminPassword;

  if (!isValid) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  return res.status(200).json({
    ok: true,
    user: {
      name: 'Admin User',
    },
  });
}
