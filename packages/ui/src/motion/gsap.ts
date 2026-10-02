"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Plugins are registered once, here, so no component has to remember to. Import gsap and ScrollTrigger from
// this file (re-exported by "@pandora/ui") and never from "gsap" directly.
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export { gsap, ScrollTrigger, useGSAP };
