"use client";

import MurmurationWordmark from "@/components/ui/murmuration-wordmark";
import { drawSchoolScene } from "./sanady-flock-scene";
import { SANADY_SHAPE } from "./sanady-flock-shape";

/**
 * Homepage band: a starling flock that gathers into the Sanady logo, the eyes
 * and smile flown by birds that turn orange as they settle. Client-side so the
 * traced points ship in the script bundle, not in the page payload.
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
      ground={drawSchoolScene}
      palette={{ skyTop: "#fcfbfa", skyLow: "#ffe6d5", sun: "#ffc9a8", ink: "#1a1715" }}
      height="clamp(18rem, 48vw, 30rem)"
    />
  );
}
