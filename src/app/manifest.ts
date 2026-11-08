import type { MetadataRoute } from "next";

// Lets athletes "Add to Home Screen" on iPhone and Android (spec §2)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TYPERFORMANCE",
    short_name: "TYPERFORMANCE",
    description: "Training load, testing and strength tools",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
