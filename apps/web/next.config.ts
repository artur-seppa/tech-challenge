import { config } from 'dotenv';
import type { NextConfig } from 'next';

// Next.js only loads .env files from this app's own directory; the real .env
// lives at the monorepo root (shared with the backend services), so it has to
// be loaded explicitly here, before the app reads any NEXT_PUBLIC_* variable.
config({ path: '../../.env' });

const nextConfig: NextConfig = {};

export default nextConfig;
