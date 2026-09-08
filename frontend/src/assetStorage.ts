// Persistência dos arquivos de asset importados (pasta de imagens) via
// IndexedDB — localStorage (persistence.ts) não aceita binário nem tem
// espaço pra isso. Guarda o File original por path; ao restaurar, o
// objectURL é recriado a partir do Blob salvo (o objectURL em si nunca
// sobrevive a um reload, só o dado por trás dele).

const DB_NAME = "esth-assets";
const STORE_NAME = "files";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Salva um asset por path (ex: "./core/frame.png"). Best-effort: falha
// silenciosa se IndexedDB estiver indisponível (modo privado em alguns
// navegadores, quota, etc.) — não deve travar a importação em si.
export async function saveAssetFile(key: string, file: File): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(file, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // best-effort
  }
}

export async function loadAllAssetFiles(): Promise<Record<string, Blob>> {
  try {
    const db = await openDb();
    const result = await new Promise<Record<string, Blob>>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const keysReq = store.getAllKeys();
      const valuesReq = store.getAll();
      tx.oncomplete = () => {
        const keys = keysReq.result as string[];
        const values = valuesReq.result as Blob[];
        const map: Record<string, Blob> = {};
        keys.forEach((key, i) => {
          map[key] = values[i];
        });
        resolve(map);
      };
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return result;
  } catch {
    return {};
  }
}

export async function clearAssetFiles(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // best-effort
  }
}
