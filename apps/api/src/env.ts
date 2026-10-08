import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret',
  WEB_URL: process.env.WEB_URL ?? 'http://localhost:5173',
};
if (process.env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-secret') {
  throw new Error('JWT_SECRET must be set in production');
}
