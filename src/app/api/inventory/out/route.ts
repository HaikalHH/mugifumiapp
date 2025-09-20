import { NextRequest, NextResponse } from "next/server";

// This endpoint is deprecated and removed per latest requirements.
// Keeping the file to prevent 404 errors but no actual functionality
export async function GET() {
  return NextResponse.json({ error: "This endpoint is deprecated" }, { status: 410 });
}
