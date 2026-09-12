/**
 * GET /api/health
 * Endpoint público de health check — replica o HealthController do Spring Boot.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'OK' })
}
