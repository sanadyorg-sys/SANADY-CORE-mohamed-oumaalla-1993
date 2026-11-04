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
      palette={{ skyTop: "#fdf6ef", skyLow: "#fdf6ef", sun: "#fdf6ef", ink: "#1a1715" }}
      // Follows the illustration's 2.55:1 shape so phones keep its corners.
      height="clamp(8.5rem, calc((min(100vw, 80rem) - 2rem) / 2.55), 30rem)"
    />
  );
}
