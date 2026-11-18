import { connection, NextResponse } from "next/server";

export async function GET() {
  await connection();
  return NextResponse.json({
    status: "ok",
    tutorConfigured: Boolean(process.env.TUTOR_API_KEY && process.env.TUTOR_API_URL && process.env.TUTOR_MODEL),
  });
}
