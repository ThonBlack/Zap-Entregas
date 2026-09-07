/**
 * P1 da auditoria de frontend: a cerca de 200m deixava o botão "Entregue"
 * desabilitado pra sempre quando o GPS errava — e sumia em silêncio quando a
 * permissão de localização era negada.
 *
 * Rodar:
 *   node --import ./scripts/test/register.mjs --test scripts/test/geofence.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
    avaliarCerca, precisaJustificar, distanciaLegivel, montarNotaJustificada,
    prefixoDaJustificativa, motivoValido, calcularDistanciaMetros, RAIO_ENTREGA_METROS,
} = await import("@/lib/geofence");

// Praça de Uberaba, mais ou menos.
const LOJA = { lat: -19.7472, lng: -47.9381 };
/** Move ~N metros pro norte (1 grau de latitude ≈ 111.320 m). */
const aoNorte = (p, metros) => ({ lat: p.lat + metros / 111320, lng: p.lng });

test("Haversine bate com a distância esperada (100 m ao norte)", () => {
    const d = calcularDistanciaMetros(LOJA.lat, LOJA.lng, aoNorte(LOJA, 100).lat, LOJA.lng);
    assert.ok(Math.abs(d - 100) < 2, `esperava ~100m, veio ${d}`);
});

test("dentro do raio: finaliza direto, sem justificar", () => {
    const s = avaliarCerca({
        aplicar: true, gpsDisponivel: true,
        posicao: aoNorte(LOJA, 50), destino: LOJA,
    });
    assert.equal(s.tipo, "dentro");
    assert.equal(precisaJustificar(s), false);
});

test("fora do raio: NÃO trava, mas pede justificativa", () => {
    const s = avaliarCerca({
        aplicar: true, gpsDisponivel: true,
        posicao: aoNorte(LOJA, 1400), destino: LOJA,
    });
    assert.equal(s.tipo, "fora");
    assert.ok(s.distanciaMetros > RAIO_ENTREGA_METROS);
    assert.equal(precisaJustificar(s), true);
});

test("exatamente no limite de 200 m ainda conta como dentro", () => {
    const s = avaliarCerca({
        aplicar: true, gpsDisponivel: true,
        posicao: aoNorte(LOJA, 199), destino: LOJA,
    });
    assert.equal(s.tipo, "dentro");
});

test("GPS negado NÃO desliga a cerca em silêncio — vira sem-gps e pede justificativa", () => {
    const s = avaliarCerca({
        aplicar: true, gpsDisponivel: false, posicao: null, destino: LOJA,
    });
    assert.equal(s.tipo, "sem-gps");
    assert.equal(precisaJustificar(s), true);
});

test("corrida sem pino no banco (lat/lng 0) não pede nada: não há de onde medir", () => {
    const s = avaliarCerca({
        aplicar: true, gpsDisponivel: true,
        posicao: LOJA, destino: { lat: 0, lng: 0 },
    });
    assert.equal(s.tipo, "sem-coordenada");
    assert.equal(precisaJustificar(s), false);
});

test("lojista/admin (aplicar=false) nunca cai na cerca", () => {
    const s = avaliarCerca({
        aplicar: false, gpsDisponivel: false, posicao: null, destino: LOJA,
    });
    assert.equal(s.tipo, "dentro");
    assert.equal(precisaJustificar(s), false);
});

test("distância legível: metros abaixo de 1 km, km com vírgula acima", () => {
    assert.equal(distanciaLegivel(180), "180 m");
    assert.equal(distanciaLegivel(1400), "1,4 km");
});

test("prefixo carimba a distância quando existe, e 'sem GPS' quando não", () => {
    assert.equal(prefixoDaJustificativa(1400), "[fora do raio 1,4 km] ");
    assert.equal(prefixoDaJustificativa(null), "[sem GPS] ");
});

test("nota final junta carimbo + motivo + observação que ele já tinha escrito", () => {
    const nota = montarNotaJustificada("portão azul", "entreguei na portaria", 1400);
    assert.equal(nota, "[fora do raio 1,4 km] entreguei na portaria — portão azul");
});

test("sem observação anterior, a nota é só carimbo + motivo", () => {
    assert.equal(
        montarNotaJustificada(null, "pino na rua errada", 350),
        "[fora do raio 350 m] pino na rua errada"
    );
});

test("nota é cortada em 500 caracteres (limite da coluna)", () => {
    const nota = montarNotaJustificada(null, "x".repeat(900), 300);
    assert.equal(nota.length, 500);
});

test("motivo precisa de pelo menos 5 letras", () => {
    assert.equal(motivoValido("oi"), false);
    assert.equal(motivoValido("   "), false);
    assert.equal(motivoValido(undefined), false);
    assert.equal(motivoValido("portaria"), true);
});
