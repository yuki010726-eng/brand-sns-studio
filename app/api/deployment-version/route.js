import { NextResponse } from "next/server";
import { deploymentVersion } from "../../../lib/deployment-version.js";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: deploymentVersion },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
