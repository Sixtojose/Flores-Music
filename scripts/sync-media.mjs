import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "media";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Configure os secrets do Supabase no GitHub.");
}

const folders = [
  { folder: "musicas", type: "audio" },
  { folder: "videos", type: "video" }
];

const mimeTypes = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska"
};

async function uploadFile(file, type) {
  const extension = path.extname(file).toLowerCase();
  const contentType = mimeTypes[extension];

  if (!contentType) {
    console.log(`Formato ignorado: ${file}`);
    return;
  }

  const filename = path.basename(file);
  const storagePath = `${type}/${filename}`;
  const data = await fs.readFile(file);

  console.log(`Enviando: ${filename}`);

  const upload = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        "Content-Type": contentType,
        "x-upsert": "true"
      },
      body: data
    }
  );

  if (!upload.ok) {
    throw new Error(`Erro no upload de ${filename}: ${await upload.text()}`);
  }

  const title = path.parse(filename).name;
  const publicUrl =
    `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/media?on_conflict=storage_path`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        title,
        type,
        storage_path: storagePath,
        cover_url: publicUrl
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao registrar ${filename}: ${await response.text()}`);
  }

  console.log(`Concluído: ${filename}`);
}

async function main() {
  for (const item of folders) {
    let files = [];

    try {
      files = await fs.readdir(item.folder);
    } catch {
      console.log(`Pasta não encontrada: ${item.folder}`);
      continue;
    }

    for (const filename of files) {
      const file = path.join(item.folder, filename);
      const stat = await fs.stat(file);

      if (stat.isFile()) {
        await uploadFile(file, item.type);
      }
    }
  }

  console.log("Sincronização concluída!");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
