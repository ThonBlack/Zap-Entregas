/**
 * Gera o ícone "badge" da notificação push (public/badge-*.png).
 *
 * Por que existe: no Android o `badge` (o iconezinho da barra de status) precisa ser
 * PNG monocromático — só a silhueta branca sobre fundo transparente. O sistema pinta
 * essa silhueta com a cor dele. Se a gente manda o ícone colorido, o Android achata
 * tudo e aparece um quadrado branco.
 *
 * O que ele faz: pega public/icon-512.png, fica só com o alfa (o recorte do desenho),
 * joga fora os pedaços soltos (as "linhas de velocidade", que somem no tamanho da
 * barra de status), mantém só a maior peça (moto + piloto + raio) e sai em branco puro.
 *
 * Rodar: node scripts/utils/gen_badge_icon.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = path.join(ROOT, "public/icon-512.png");
const SIZES = [72, 96, 128];
const ALPHA_CUT = 110; // abaixo disso o pixel conta como vazio

/** Mantém só a maior mancha conectada da máscara (descarta respingos soltos). */
function keepLargestBlob(data, width, height) {
    const label = new Int32Array(width * height).fill(-1);
    const stack = new Int32Array(width * height);
    const sizes = [];

    for (let start = 0; start < width * height; start++) {
        if (data[start] < 128 || label[start] >= 0) continue;
        const id = sizes.length;
        let top = 0;
        let count = 0;
        stack[top++] = start;
        label[start] = id;
        while (top > 0) {
            const p = stack[--top];
            count++;
            const x = p % width;
            const y = (p / width) | 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const q = ny * width + nx;
                    if (data[q] >= 128 && label[q] < 0) {
                        label[q] = id;
                        stack[top++] = q;
                    }
                }
            }
        }
        sizes.push(count);
    }

    const biggest = sizes.indexOf(Math.max(...sizes));
    const out = Buffer.alloc(width * height);
    for (let i = 0; i < width * height; i++) if (label[i] === biggest) out[i] = 255;
    return out;
}

const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .extractChannel("alpha")
    .threshold(ALPHA_CUT)
    .raw()
    .toBuffer({ resolveWithObject: true });

const blob = keepLargestBlob(data, info.width, info.height);
const silhouette = await sharp(blob, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png()
    .trim({ threshold: 10 })
    .toBuffer();

for (const size of SIZES) {
    const inner = Math.round(size * 0.9); // respiro nas bordas, senão o Android corta
    const mask = await sharp(silhouette).resize(inner, inner, { fit: "inside" }).toBuffer();
    const { width, height } = await sharp(mask).metadata();
    const raw = await sharp(mask).toColourspace("b-w").raw().toBuffer();

    const white = await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
        .joinChannel(raw, { raw: { width, height, channels: 1 } })
        .png()
        .toBuffer();

    const target = path.join(ROOT, `public/badge-${size}.png`);
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: white, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
        .png()
        .toFile(target);
    console.log("gerado:", target);
}
