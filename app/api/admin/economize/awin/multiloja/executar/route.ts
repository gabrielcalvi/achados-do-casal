import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Sandbox,
} from "@vercel/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SANDBOX_NAME =
  process.env.KABUM_AWIN_SANDBOX_NAME ||
  "achados-cupons-ml-test";

function autorizado(
  request: NextRequest
) {
  const segredo =
    process.env.CRON_SECRET?.trim();

  if (!segredo) {
    return false;
  }

  return (
    request.headers.get(
      "authorization"
    ) ===
    `Bearer ${segredo}`
  );
}

async function executar(
  request: NextRequest
) {
  if (!autorizado(request)) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Nao autorizado.",
      },
      {
        status: 401,
      }
    );
  }

  const awinToken =
    process.env.AWIN_API_TOKEN;

  const publisher =
    process.env.AWIN_PUBLISHER_ID ||
    "2922231";

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (
    !awinToken ||
    !supabaseUrl ||
    !serviceKey
  ) {
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          "Variaveis Awin/Supabase incompletas.",
      },
      {
        status: 500,
      }
    );
  }

  try {
    const sandbox =
      await Sandbox.get({
        name: SANDBOX_NAME,
      });

    const existe =
      await sandbox.runCommand({
        cmd: "test",
        args: [
          "-f",
          "/vercel/scripts/orquestrar-awin-lojas.cjs",
        ],
      });

    if (existe.exitCode !== 0) {
      throw new Error(
        "Orquestrador Awin multiloja nao encontrado."
      );
    }

    await sandbox.runCommand({
      cmd: "node",
      args: [
        "/vercel/scripts/orquestrar-awin-lojas.cjs",
      ],
      env: {
        AWIN_API_TOKEN:
          awinToken,

        AWIN_PUBLISHER_ID:
          publisher,

        NEXT_PUBLIC_SUPABASE_URL:
          supabaseUrl,

        SUPABASE_SERVICE_ROLE_KEY:
          serviceKey,
      },
      detached: true,
    });

    return NextResponse.json(
      {
        sucesso: true,
        iniciado: true,
        sandbox:
          SANDBOX_NAME,
        lojas: [
          "cea",
          "renner",
          "calvin-klein",
          "stanley",
        ],
        iniciadoEm:
          new Date().toISOString(),
      },
      {
        status: 202,
      }
    );
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          erro instanceof Error
            ? erro.message
            : String(erro),
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(
  request: NextRequest
) {
  return executar(request);
}

export async function POST(
  request: NextRequest
) {
  return executar(request);
}
