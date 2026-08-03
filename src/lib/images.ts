/**
 * Sprites are hotlinked from terraria.wiki.gg, so an occasional rename leaves a dead URL.
 * Hiding the element keeps the browser's broken-image glyph out of an otherwise tidy grid;
 * the layout already reserves the space.
 */
export function hideBrokenImage(event: Event) {
	const image = event.currentTarget as HTMLImageElement;
	image.style.visibility = 'hidden';
}
