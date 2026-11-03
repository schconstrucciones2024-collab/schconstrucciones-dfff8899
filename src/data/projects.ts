import ficha2015 from "@/assets/ficha-2015-datos.jpg.asset.json";
import ficha2019 from "@/assets/ficha-2019-datos.jpg.asset.json";
import ficha2020 from "@/assets/ficha-2020-datos.jpg.asset.json";
import ficha2021 from "@/assets/ficha-2021-datos.jpg.asset.json";
import ficha2022 from "@/assets/ficha-2022-datos.jpg.asset.json";
import ficha2023 from "@/assets/ficha-2023-datos.jpg.asset.json";
import ficha2023Ampliacion from "@/assets/ficha-2023-ampliacion-datos.jpg.asset.json";
import ficha2024 from "@/assets/ficha-2024-datos.jpg.asset.json";
import ficha2025 from "@/assets/ficha-2025-datos.png.asset.json";
import fichaContenedor from "@/assets/ficha-contenedor-datos.jpg.asset.json";
import proyectoAlvear from "@/assets/portada-complejo-alvear.jpg.asset.json";
import proyectoLeSirenuse from "@/assets/portada-le-sirenuse.jpg.asset.json";
import proyecto2015 from "@/assets/portada-pequenas-diablitas.jpg.asset.json";
import proyecto2019 from "@/assets/portada-la-diosa.jpg.asset.json";
import proyecto2020 from "@/assets/portada-ampliacion-2020.jpg.asset.json";
import proyecto2021 from "@/assets/portada-cabana-bosque.jpg.asset.json";
import proyecto2022 from "@/assets/portada-lo-de-cata.jpg.asset.json";
import proyecto2023 from "@/assets/portada-mi-sueno-2023.jpg.asset.json";
import proyecto2023Ampliacion from "@/assets/portada-ampliacion-2023.jpg.asset.json";
import proyecto2024 from "@/assets/portada-laslu.png.asset.json";
import proyecto2025 from "@/assets/portada-barbacoa.jpg.asset.json";
import proyectoContenedor from "@/assets/portada-contenedor.png.asset.json";
import leSirenuseHistoria from "@/assets/le-sirenuse-no-fue-solo-un-proyecto.jpg.asset.json";
import leSirenuseSueno from "@/assets/le-sirenuse-antes-de-ser-una-obra.jpg.asset.json";
import complejoAlvearProyecto from "@/assets/complejo-alvear-antes-de-le-sirenuse.jpg.asset.json";
import complejoAlvearHistoria from "@/assets/complejo-alvear-5-cabanas.jpg.asset.json";

export type Project = {
  /** URL de la portada (primera imagen de la galería). */
  src: string;
  /** Portada + imágenes adicionales, en el orden de la galería. */
  images: string[];
  alt: string;
  year: string;
  name: string;
};

/**
 * Obras reales de SCH Construcciones, de la más reciente a la más antigua.
 * Los nombres, años y textos alternativos son los del sitio original: no se modifican.
 */
export const PROJECTS: Project[] = [
  { src: proyecto2025.url, images: [proyecto2025.url, ficha2025.url], alt: "Proyecto 2025-2026 · Barbacoa · Punta del Diablo", year: "2025-26", name: "Barbacoa · Punta del Diablo" },
  { src: proyecto2024.url, images: [proyecto2024.url, ficha2024.url], alt: "Proyecto 2024 · Laslu · Punta del Diablo", year: "2024", name: "Laslu" },
  { src: proyecto2023Ampliacion.url, images: [proyecto2023Ampliacion.url, ficha2023Ampliacion.url], alt: "Ampliación en proceso realizada por SCH Construcciones", year: "2023", name: "Ampliación en proceso" },
  { src: proyecto2023.url, images: [proyecto2023.url, ficha2023.url], alt: "Proyecto 2023 · Mi Sueño · Punta del Diablo", year: "2023", name: "Mi Sueño" },
  { src: proyecto2022.url, images: [proyecto2022.url, ficha2022.url], alt: "Proyecto 2022-2023 · Lo de Cata · Punta del Diablo", year: "2022-23", name: "Lo de Cata" },
  { src: proyecto2021.url, images: [proyecto2021.url, ficha2021.url], alt: "Proyecto 2021 · Punta del Diablo", year: "2021", name: "Cabaña en el bosque" },
  { src: proyecto2020.url, images: [proyecto2020.url, ficha2020.url], alt: "Ampliación realizada entre 2020 y 2021 por SCH Construcciones", year: "2020-21", name: "Ampliación" },
  { src: proyectoContenedor.url, images: [proyectoContenedor.url, fichaContenedor.url], alt: "Transformación de contenedor realizada por SCH Construcciones", year: "Proyecto", name: "Transformación de contenedor" },
  { src: proyecto2019.url, images: [proyecto2019.url, ficha2019.url], alt: "Proyecto 2019-2020 · La Diosa - La Clave del Diablo · Punta del Diablo", year: "2019-20", name: "La Diosa" },
  { src: proyecto2015.url, images: [proyecto2015.url, ficha2015.url], alt: "Proyecto 2015 · Pequeñas Diablitas", year: "2015", name: "Pequeñas Diablitas" },
  { src: proyectoLeSirenuse.url, images: [proyectoLeSirenuse.url, leSirenuseHistoria.url, leSirenuseSueno.url], alt: "Proyecto Le Sirenuse realizado por SCH Construcciones", year: "Trayectoria", name: "Le Sirenuse" },
  { src: proyectoAlvear.url, images: [proyectoAlvear.url, complejoAlvearProyecto.url, complejoAlvearHistoria.url], alt: "Complejo Alvear realizado por SCH Construcciones", year: "Trayectoria", name: "Complejo Alvear" },
];

/** Contacto y redes oficiales (única fuente para header, contacto y pie). */
export const CONTACT = {
  whatsapp: "https://wa.me/59895564068",
  whatsappLabel: "+598 95 564 068",
  email: "sch.construcciones2024@gmail.com",
  instagram: "https://www.instagram.com/sch_construcciones_/",
  facebook: "https://www.facebook.com/share/19CeKwxrSK/",
  tiktok: "https://www.tiktok.com/@sch_construcciones_?_r=1&_t=ZS-99gXbTq467B",
  pinterest: "https://pin.it/JdGW6Fisb",
  google: "https://share.google/hW0EK0aERStyHuqfg",
  address: "Av. Central, Punta del Diablo, Rocha, Uruguay",
} as const;
