/// <reference types="file-saver" />

declare module "linear-interpolator";
declare module "piexifjs";
declare module "ohauth";
declare module "d3-regression";
declare module "xml-beautify";

declare module "file-saver-es" {
    const saveAsFunction: typeof saveAs;
    export { saveAsFunction as saveAs };
}
