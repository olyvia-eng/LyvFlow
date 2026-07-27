export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV !== 'production') {
      if (name === 'AWS_REGION') return 'us-east-1';
      if (name === 'DDB_TABLE_NAME') return 'OliveOpsAuth';
      if (name === 'JWT_SECRET') return 'dev-only-jwt-secret';
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}
