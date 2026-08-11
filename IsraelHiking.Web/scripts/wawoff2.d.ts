// wawoff2 ships no types of its own and there is no @types package for it.
declare module 'wawoff2' {
    export function compress(input: Uint8Array): Promise<Uint8Array>;
    export function decompress(input: Uint8Array): Promise<Uint8Array>;
}
