// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/domManagement.js
function IsWindowObjectExist() {
  return typeof window !== "undefined";
}
function IsNavigatorAvailable() {
  return typeof navigator !== "undefined";
}
function IsDocumentAvailable() {
  return typeof document !== "undefined";
}
function GetDOMTextContent(element) {
  let result = "";
  let child = element.firstChild;
  while (child) {
    if (child.nodeType === 3) {
      result += child.textContent;
    }
    child = child.nextSibling;
  }
  return result;
}

export {
  IsWindowObjectExist,
  IsNavigatorAvailable,
  IsDocumentAvailable,
  GetDOMTextContent
};
//# sourceMappingURL=chunk-AB3HOSPI.js.map
