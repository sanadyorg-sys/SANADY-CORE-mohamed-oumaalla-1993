"use client";

import MurmurationWordmark from "@/components/ui/murmuration-wordmark";
import { SANADY_SHAPE } from "./sanady-flock-shape";

/**
 * Homepage band: a starling flock that gathers into the Sanady logo, the eyes
 * and smile flown by birds that turn orange as they settle, over an orange
 * illustration of school, class and platform (public/brand/flock-backdrop.jpg).
 * Client-side so the traced points ship in the script bundle, not in the page
 * payload.
 */
export function SanadyFlock() {
  return (
    <MurmurationWordmark
      word="sanady"
      shape={SANADY_SHAPE}
      accent="#e04e00"
      birds={14000}
      speed={0.45}
      flyFor={3.5}
      holdFor={2.6}
      backdrop="/brand/flock-backdrop.jpg"
      reeds={false}
      bounds={{ top: 0.05, bottom: 0.62 }}
      // Smaller, lighter birds and a smaller logo: the flock reads as far off.
      birdScale={0.62}
      logoWidth={0.5}
      palette={{ skyTop: "#fde8d6", skyLow: "#fde8d6", sun: "#fde8d6", ink: "#3a302b" }}
      // Follows the illustration's 2.55:1 shape so phones keep its corners.
      height="clamp(8.5rem, calc((min(100vw, 80rem) - 2rem) / 2.55), 30rem)"
    />
  );
}
