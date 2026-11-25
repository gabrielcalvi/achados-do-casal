import type { ProdutoExtraidoWorker } from "@/lib/workers/playwrightWorker";
import { WORKER_URL } from "@/lib/workers/workerUrl";

export async function extrairKabumWorker(
  link: string,
  opcoes?: { timeoutMs?: number }
): Promise<ProdutoExtraidoWorker> {
  let resposta: Response;
  const timeoutMs = Math.max(
    5_000,
    Math.min(Number(opcoes?.timeoutMs) || 300_000, 300_000),
  );

  try {
    resposta = await fetch(
      `${WORKER_URL}/extrair?url=${encodeURIComponent(link)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : "falha de conexão";
    throw new Error(
      `O Playwright Worker não está acessível em ${WORKER_URL}. Detalhe: ${detalhe}`
    );
  }

  let json: { sucesso?: boolean; dados?: ProdutoExtraidoWorker; erro?: string };

  try {
    json = await resposta.json();
  } catch {
    throw new Error(
      `O Playwright Worker respondeu em formato inválido (${resposta.status}).`
    );
  }

  if (!resposta.ok || !json.sucesso || !json.dados) {
    throw new Error(
      json.erro || `Playwright Worker respondeu ${resposta.status}.`
    );
  }

  return json.dados;
}
