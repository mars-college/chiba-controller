import { Text } from "@mantine/core";

export type PreviewTile = {
  src?: string;
  label: string;
};

type Props = {
  tiles: PreviewTile[];
  totalCount?: number;
  height?: number;
};

export function PreviewTileCluster({ tiles, totalCount, height = 160 }: Props) {
  const visibleTiles = tiles.slice(0, 4);
  const tileCount = Math.min(Math.max(visibleTiles.length, 1), 4);
  const moreCount =
    typeof totalCount === "number"
      ? Math.max(0, totalCount - visibleTiles.length)
      : Math.max(0, tiles.length - visibleTiles.length);

  const paddedTiles = Array.from({ length: 4 }, (_, index) => {
    const tile = visibleTiles[index];
    if (tile) return tile;
    return { label: `${index + 1}` };
  });

  return (
    <div
      className={`ops-playlist-cover ops-playlist-cover-${tileCount}`}
      style={{ height }}
    >
      {paddedTiles.map((tile, index) => {
        const fallbackText = (tile.label || `${index + 1}`)
          .slice(0, 1)
          .toUpperCase();
        return (
          <div key={`preview-tile-${index}`} className="ops-playlist-cover-tile">
            {tile.src ? (
              <img className="ops-playlist-cover-img" src={tile.src} alt={tile.label} />
            ) : (
              <div className="ops-playlist-cover-fallback">
                <Text fw={700}>{fallbackText}</Text>
              </div>
            )}
          </div>
        );
      })}
      {moreCount > 0 ? (
        <div className="ops-playlist-cover-more">+{moreCount}</div>
      ) : null}
    </div>
  );
}
