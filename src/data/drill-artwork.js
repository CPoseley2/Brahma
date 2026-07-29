const modules = import.meta.glob("../assets/drill-cards/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const artwork = new Map(Object.entries(modules).map(([path, url]) => [path.split("/").pop().replace(/\.png$/i, ""), url]));

export const drillArtworkUrl = drillId => artwork.get(drillId) || "";
export const bundledDrillArtworkCount = () => artwork.size;
