export async function selectObsConfigFile() {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      { name: "Config Files", extensions: ["ini", "conf", "cfg"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  return typeof selected === "string" ? selected : null;
}

export async function exportObsConfigFile(fileName: string, content: string) {
  const [{ save }, { writeTextFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);
  const filePath = await save({
    defaultPath: fileName,
    filters: [
      { name: "Config Files", extensions: ["ini", "conf", "cfg"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!filePath) {
    return null;
  }

  await writeTextFile(filePath, content);
  return filePath;
}
