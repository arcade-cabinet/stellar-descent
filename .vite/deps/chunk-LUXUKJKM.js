// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/typeStore.js
var RegisteredTypes = {};
function RegisterClass(className, type) {
  RegisteredTypes[className] = type;
}
function GetClass(fqdn) {
  return RegisteredTypes[fqdn];
}

export {
  RegisterClass,
  GetClass
};
//# sourceMappingURL=chunk-LUXUKJKM.js.map
