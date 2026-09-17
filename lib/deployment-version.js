// Server-only deployment fingerprint. Vercel changes DEPLOYMENT_ID even when a
// deployment is rebuilt from the same commit.
export const deploymentVersion =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.BUILD_ID ||
  "local";
