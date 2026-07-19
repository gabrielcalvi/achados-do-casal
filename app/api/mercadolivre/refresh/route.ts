import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Rota de renovação ainda não implementada.",
    },
    {
      status: 501,
    }
  );
}