import { randomBytes } from "crypto";

// Token opaco para o link público de rastreio (substitui o ID sequencial,
// que permitia enumerar entregas de outros clientes).
export function newTrackingToken(): string {
    return randomBytes(12).toString("base64url");
}
