import path from "node:path";

// ContentSource.storagePath is stored REPO-RELATIVE (e.g.
// "uploads/1782105978533-Test_Exam_Sample.pdf"), never absolute.
//
// It used to be absolute (path.join(process.cwd(), "uploads")), which broke
// every existing row the first time the repo directory moved — the files were
// still on disk, but the DB pointed at the old location. Relative paths survive
// a move, a different machine, and a deploy; absolute ones do not.
//
// Resolution to a real filesystem path happens HERE, at read time, against the
// current process's cwd — the one place that knows where the repo lives now.
export const UPLOAD_DIR_RELATIVE = "uploads";

export function toStoragePath(storedFileName: string): string {
  return path.posix.join(UPLOAD_DIR_RELATIVE, storedFileName);
}

export function resolveStoragePath(storagePath: string): string {
  // Absolute paths are legacy rows written before this convention. Honour them
  // if they happen to resolve, so a repaired and an unrepaired DB both work.
  if (path.isAbsolute(storagePath)) return storagePath;
  return path.join(process.cwd(), storagePath);
}
