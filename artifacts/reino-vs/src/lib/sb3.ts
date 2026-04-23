import JSZip from "jszip";
import type { Sprite, Backdrop } from "./vs-runtime";

interface VSProjectData {
  name: string;
  code: string;
  sprites: Sprite[];
  backdrops: Backdrop[];
  isPublic: boolean;
  format: string;
}

// Minimal valid Scratch 3 project.json so .sb3 can be opened by Scratch (will appear as empty).
// We embed the full VS data inside meta so re-importing into Reino VS preserves everything.
function buildProjectJson(data: VSProjectData): any {
  return {
    targets: [
      {
        isStage: true,
        name: "Stage",
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {
          reinoVsData: {
            blockId: null,
            x: 10,
            y: 10,
            width: 600,
            height: 400,
            minimized: false,
            text: "REINO_VS_DATA:" + JSON.stringify(data),
          },
        },
        currentCostume: 0,
        costumes: [
          {
            name: "fondo1",
            dataFormat: "svg",
            assetId: "cd21514d0531fdffb22204e0ec5ed84a",
            md5ext: "cd21514d0531fdffb22204e0ec5ed84a.svg",
            rotationCenterX: 240,
            rotationCenterY: 180,
          },
        ],
        sounds: [],
        volume: 100,
        layerOrder: 0,
        tempo: 60,
        videoTransparency: 50,
        videoState: "on",
        textToSpeechLanguage: null,
      },
      ...data.sprites.map((sp, i) => ({
        isStage: false,
        name: sp.name,
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [
          {
            name: sp.name,
            dataFormat: "svg",
            assetId: "b7853f557e4426412e64bb3da6531a99",
            md5ext: "b7853f557e4426412e64bb3da6531a99.svg",
            rotationCenterX: 47,
            rotationCenterY: 55,
          },
        ],
        sounds: [],
        volume: 100,
        layerOrder: i + 1,
        visible: sp.visible,
        x: sp.x,
        y: sp.y,
        size: sp.size,
        direction: sp.rot,
        draggable: false,
        rotationStyle: "all around",
      })),
    ],
    monitors: [],
    extensions: [],
    meta: {
      semver: "3.0.0",
      vm: "0.2.0",
      agent: "Reino VS Studio",
      reinoVs: data,
    },
  };
}

// Tiny placeholder SVG (a stage backdrop and a sprite). Both Scratch-compatible.
const SVG_BACKDROP = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#ffffff"/></svg>`;
const SVG_SPRITE = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="95" height="110"><circle cx="47" cy="55" r="40" fill="#c0902a" stroke="#6b4a1f" stroke-width="3"/></svg>`;

export async function exportSb3(data: VSProjectData): Promise<Blob> {
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(buildProjectJson(data)));
  zip.file("cd21514d0531fdffb22204e0ec5ed84a.svg", SVG_BACKDROP);
  zip.file("b7853f557e4426412e64bb3da6531a99.svg", SVG_SPRITE);
  // Also include raw VS data for easy access
  zip.file("reinovs.json", JSON.stringify(data, null, 2));
  return zip.generateAsync({ type: "blob", mimeType: "application/x.scratch.sb3" });
}

export async function importSb3(file: File): Promise<VSProjectData | null> {
  const buf = await file.arrayBuffer();
  // .json fallback
  if (file.name.endsWith(".json") || file.name.endsWith(".reinovs.json")) {
    try {
      return JSON.parse(new TextDecoder().decode(buf));
    } catch { return null; }
  }
  try {
    const zip = await JSZip.loadAsync(buf);
    // Prefer reinovs.json
    const raw = zip.file("reinovs.json");
    if (raw) {
      const txt = await raw.async("string");
      return JSON.parse(txt);
    }
    const pj = zip.file("project.json");
    if (pj) {
      const json = JSON.parse(await pj.async("string"));
      if (json.meta?.reinoVs) return json.meta.reinoVs;
      // Try comment payload
      const stage = (json.targets ?? []).find((t: any) => t.isStage);
      const cmts = stage?.comments ?? {};
      for (const k in cmts) {
        const txt = cmts[k]?.text ?? "";
        if (txt.startsWith("REINO_VS_DATA:")) {
          return JSON.parse(txt.slice("REINO_VS_DATA:".length));
        }
      }
      // Build a basic VS project from a real Scratch sb3
      const sprites: Sprite[] = (json.targets ?? [])
        .filter((t: any) => !t.isStage)
        .map((t: any, i: number) => ({
          id: "s" + i,
          name: t.name,
          costumes: ["🎭"],
          costumeIdx: 0,
          x: t.x ?? 0, y: t.y ?? 0, rot: t.direction ?? 90, size: t.size ?? 100,
          visible: t.visible !== false,
        }));
      return {
        name: "Importado de Scratch",
        code: ";al iniciar\nfuncion decir Importado de Scratch\n",
        sprites,
        backdrops: [{ name: "fondo1", gradient: "linear-gradient(180deg,#fff,#aaa)" }],
        isPublic: false,
        format: "reino-vs/1",
      };
    }
  } catch {
    return null;
  }
  return null;
}
