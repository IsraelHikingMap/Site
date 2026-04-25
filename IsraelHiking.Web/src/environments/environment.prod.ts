export const environment = {
    production: true,
    baseAddress: typeof window !== "undefined" ? window.location.origin : "https://mapeak.com",
    baseApiAddress: typeof window !== "undefined" ? window.location.origin + "/api/" : "https://mapeak.com/api",
    baseTilesAddress: typeof window !== "undefined" ? window.location.origin : "https://mapeak.com",
    isCapacitor: false
};
