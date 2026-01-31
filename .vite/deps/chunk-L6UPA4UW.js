// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/guid.js
function RandomGUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}

export {
  RandomGUID
};
//# sourceMappingURL=chunk-L6UPA4UW.js.map
