/**
 * P2 da auditoria de frontend: o LocationTracker mandava a posição pro servidor
 * a cada leitura do GPS (1 por segundo no Android) — bateria e dado do motoboy.
 *
 * Rodar:
 *   node --import ./scripts/test/register.mjs --test scripts/test/gpsThrottle.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
    deveEnviarPosicao, distanciaHaversine, INTERVALO_MINIMO_MS, DISTANCIA_MINIMA_METROS,
} = await import("@/lib/gpsThrottle");

const AGORA = 1_700_000_000_000;
const P = { lat: -19.7472, lng: -47.9381 };
const aoNorte = (p, metros) => ({ lat: p.lat + metros / 111320, lng: p.lng });

test("primeira leitura sempre vai (senão a loja não vê ninguém no mapa)", () => {
    assert.equal(deveEnviarPosicao({ ultimoEnvio: null, agora: AGORA, nova: P }), true);
});

test("andou muito, mas faz 2 segundos: NÃO manda", () => {
    const ok = deveEnviarPosicao({
        ultimoEnvio: { ...P, quando: AGORA - 2000 },
        agora: AGORA,
        nova: aoNorte(P, 500),
    });
    assert.equal(ok, false);
});

test("passou 1 minuto parado no semáforo: NÃO manda (não andou 30 m)", () => {
    const ok = deveEnviarPosicao({
        ultimoEnvio: { ...P, quando: AGORA - 60_000 },
        agora: AGORA,
        nova: aoNorte(P, 5),
    });
    assert.equal(ok, false);
});

test("passou o tempo E andou o bastante: manda", () => {
    const ok = deveEnviarPosicao({
        ultimoEnvio: { ...P, quando: AGORA - INTERVALO_MINIMO_MS },
        agora: AGORA,
        nova: aoNorte(P, DISTANCIA_MINIMA_METROS + 5),
    });
    assert.equal(ok, true);
});

test("exatamente no limite (15 s e 30 m) manda", () => {
    const ok = deveEnviarPosicao({
        ultimoEnvio: { ...P, quando: AGORA - 15_000 },
        agora: AGORA,
        nova: aoNorte(P, 31),
    });
    assert.equal(ok, true);
});

test("aceita uma função de distância de fora (é a do geolib no app)", () => {
    let chamou = false;
    const ok = deveEnviarPosicao({
        ultimoEnvio: { ...P, quando: AGORA - 60_000 },
        agora: AGORA,
        nova: aoNorte(P, 1),
        distancia: () => { chamou = true; return 999; },
    });
    assert.equal(chamou, true);
    assert.equal(ok, true);
});

test("uma jornada de 8h a 1 leitura por segundo cai de 28.800 pra ~1.900 envios", () => {
    let ultimoEnvio = null;
    let envios = 0;
    // Motoboy andando a ~7 m/s (25 km/h) o tempo todo: o pior caso.
    for (let s = 0; s < 8 * 3600; s++) {
        const nova = aoNorte(P, s * 7);
        if (deveEnviarPosicao({ ultimoEnvio, agora: AGORA + s * 1000, nova })) {
            ultimoEnvio = { ...nova, quando: AGORA + s * 1000 };
            envios++;
        }
    }
    assert.ok(envios < 2000, `esperava menos de 2000 envios, deu ${envios}`);
    assert.ok(envios > 1000, `esperava mais de 1000 envios em movimento, deu ${envios}`);
});

test("Haversine do throttle bate com a do geofence", () => {
    const d = distanciaHaversine(P.lat, P.lng, aoNorte(P, 100).lat, P.lng);
    assert.ok(Math.abs(d - 100) < 2, `esperava ~100m, veio ${d}`);
});
