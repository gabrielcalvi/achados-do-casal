export function formatarTempoDeUso(
  dataInicio?: string | null,
  fallback?: string | null,
  referencia = new Date()
) {
  if (!dataInicio) return fallback || "Não informado";

  const partes = dataInicio.split("-").map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) {
    return fallback || "Não informado";
  }

  const [anoInicio, mesInicio, diaInicio] = partes;
  let meses =
    (referencia.getFullYear() - anoInicio) * 12 +
    (referencia.getMonth() + 1 - mesInicio);

  if (referencia.getDate() < diaInicio) {
    meses -= 1;
  }

  meses = Math.max(0, meses);

  const anos = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  const partesTexto: string[] = [];

  if (anos > 0) {
    partesTexto.push(`${anos} ${anos === 1 ? "ano" : "anos"}`);
  }

  if (mesesRestantes > 0 || anos === 0) {
    partesTexto.push(
      `${mesesRestantes} ${mesesRestantes === 1 ? "mês" : "meses"}`
    );
  }

  return partesTexto.join(" e ");
}
