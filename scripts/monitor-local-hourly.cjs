const URL_MONITOR =
  process.env.MONITOR_LOCAL_URL ||
  "http://127.0.0.1:3000/api/monitor/run?modo=local";

const INTERVALO_MS = 60 * 60 * 1000;

let executando = false;

function agora() {
  return new Date().toLocaleString("pt-BR");
}

async function executarMonitor() {
  if (executando) {
    console.log(`[${agora()}] Rodada anterior ainda em execução. Pulando esta chamada.`);
    return;
  }

  executando = true;

  try {
    console.log(`\n[${agora()}] Iniciando rodada automática do Monitor local...`);

    const resposta = await fetch(URL_MONITOR, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(55 * 60 * 1000),
    });

    const texto = await resposta.text();
    let dados = null;

    try {
      dados = JSON.parse(texto);
    } catch {
      // Mantém o texto bruto abaixo.
    }

    if (!resposta.ok || !dados?.sucesso) {
      console.error(
        `[${agora()}] Falha na rodada do Monitor:`,
        dados || texto
      );
      return;
    }

    console.log(
      `[${agora()}] Monitor concluído: ` +
        `${dados.total ?? 0} produtos, ` +
        `${dados.alterados ?? 0} preços atualizados, ` +
        `${dados.erros ?? 0} erros.`
    );
  } catch (erro) {
    console.error(
      `[${agora()}] Erro ao chamar o Monitor local:`,
      erro instanceof Error ? erro.message : erro
    );
  } finally {
    executando = false;
  }
}

console.log("Monitor local automático iniciado.");
console.log(`Endpoint: ${URL_MONITOR}`);
console.log("Frequência: 1 vez por hora.");
console.log("Os preços válidos encontrados são aplicados automaticamente.");

void executarMonitor();
setInterval(() => {
  void executarMonitor();
}, INTERVALO_MS);
