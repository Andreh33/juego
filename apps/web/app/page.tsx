import { GameClient } from '../components/GameClient';

// Shell jugable de UMBRAL (Bloque 13): menu -> Recipiente/Velo/modo -> run completa
// (mapa, combate, tienda, evento, descanso, recompensa, fin) sobre el engine puro via Zustand.
// El render premium con PixiJS + laminas (§17) llega cuando entren los assets; aqui el HUD y
// las pantallas son DOM/Tailwind con placeholders de calidad.
export default function Home() {
  return <GameClient />;
}
