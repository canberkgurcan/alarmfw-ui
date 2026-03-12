const fs = require("node:fs");

async function copyThenUnlink(src, dest) {
  await fs.promises.copyFile(src, dest);
  await fs.promises.unlink(src);
}

const originalRename = fs.rename.bind(fs);
fs.rename = function patchedRename(src, dest, callback) {
  return originalRename(src, dest, (err) => {
    if (!err || err.code !== "EXDEV") {
      callback(err);
      return;
    }
    copyThenUnlink(src, dest).then(
      () => callback(null),
      (copyErr) => callback(copyErr),
    );
  });
};

const originalRenameSync = fs.renameSync.bind(fs);
fs.renameSync = function patchedRenameSync(src, dest) {
  try {
    originalRenameSync(src, dest);
  } catch (err) {
    if (!err || err.code !== "EXDEV") {
      throw err;
    }
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
};

if (fs.promises && typeof fs.promises.rename === "function") {
  const originalRenamePromise = fs.promises.rename.bind(fs.promises);
  fs.promises.rename = async function patchedRenamePromise(src, dest) {
    try {
      await originalRenamePromise(src, dest);
    } catch (err) {
      if (!err || err.code !== "EXDEV") {
        throw err;
      }
      await copyThenUnlink(src, dest);
    }
  };
}
