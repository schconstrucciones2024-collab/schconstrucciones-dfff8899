import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  request: z.string().trim().min(3).max(800),
  design: z.string().max(60000),
});

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "conflicts", "proposals"],
  properties: {
    summary: { type: "string" },
    conflicts: { type: "array", items: { type: "string" } },
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stairId", "x", "z", "rotationDeg", "type", "reason"],
        properties: {
          stairId: { type: "string" },
          x: { type: "number" },
          z: { type: "number" },
          rotationDeg: { type: "number" },
          type: { type: "string", enum: ["recta", "L", "U", "caracol"] },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

export type StairAdvice = {
  summary: string;
  conflicts: string[];
  proposals: { stairId: string; x: number; z: number; rotationDeg: number; type: "recta" | "L" | "U" | "caracol"; reason: string }[];
};

export const reviewStairs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; advice: StairAdvice } | { ok: false; error: string }> => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "Sos un arquitecto que revisa escaleras interiores de cabañas de madera en planta métrica (metros, eje X y Z, rotación en grados donde 0° sube hacia +Z). " +
          "Recibís el diseño en JSON con contorno, paredes por piso, muebles, escaleras con su huella y hueco del piso superior, y conflictos ya detectados por el validador. " +
          "Detectá conflictos entre escaleras, huecos, paredes y muebles, explicalos en español rioplatense breve, y proponé una posición viable para cada escalera interior afectada según el pedido del cliente. " +
          "La huella debe quedar dentro del contorno, sin cruzar paredes del mismo piso ni muebles; el hueco superior no puede tocar paredes ni muebles del piso de arriba. Preferí apoyar la escalera contra una pared. Nunca muevas la escalera exterior.",
        input: [{ role: "user", content: `Pedido del cliente: ${data.request}\n\nDiseño:\n${data.design}` }],
        text: { format: { type: "json_schema", name: "stair_advice", strict: true, schema: proposalSchema } },
      });
      let text = "";
      for (const o of res.output ?? [])
        if (o.type === "message") {
          const parts: readonly { type: string; text?: string }[] = o.content;
          for (const c of parts) if (c.type === "output_text" && c.text) text += c.text;
        }
      return { ok: true, advice: JSON.parse(text) as StairAdvice };
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("stair review gateway error", e.code, e.ids);
        if (e.httpStatus === 429) return { ok: false, error: "Hay muchas consultas ahora. Probá de nuevo en un minuto." };
        if (e.httpStatus === 402) return { ok: false, error: "El asistente no tiene créditos disponibles." };
        return { ok: false, error: "No pudimos consultar al asistente. Probá de nuevo." };
      }
      console.error("stair review failed", e);
      return { ok: false, error: "La respuesta del asistente no se pudo leer. Probá de nuevo." };
    }
  });
