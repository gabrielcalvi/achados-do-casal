const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const MAX_PAGINAS = Math.max(
  1,
  Math.min(40, Number(process.env.ML_V2_MAX_PAGES || 25) || 25)
);

function numeroOuNull(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function expirado