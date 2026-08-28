/** Contrato dos mapas: a versão do Google e a do Leaflet recebem exatamente isto. */

export interface PinPickerProps {
    lat: number;
    lng: number;
    onMove: (lat: number, lng: number) => void;
    /** Recentraliza quando este número muda (o pai incrementa ao trocar o endereço). */
    recenterTrigger?: number;
    shopLat?: number | null;
    shopLng?: number | null;
    /**
     * Chave do Google restrita por site (vem do servidor por prop).
     * Vazia ou ausente = mapa do OpenStreetMap, sem tela quebrada.
     */
    googleMapsKey?: string | null;
}

export interface TrackingMapProps {
    motoboyLocation?: { lat: number; lng: number } | null;
    googleMapsKey?: string | null;
}
