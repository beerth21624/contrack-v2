// Brick type + thickness as one choice (the door-window and brick journey levels ask "which wall is it").

/** Value of the combined choice (`brick|thickness`); '' when the brick type is empty. */
export const wallTypeValue = (brick: string, thickness: string) =>
    (brick.trim() === '' ? '' : `${brick.trim()}|${thickness.trim()}`);

export function parseWallType(value: string): { brick: string; thickness: string } {
    const [brick = '', thickness = ''] = value.split('|');
    return { brick, thickness };
}

/** "อิฐมอญ ครึ่งแผ่น", … for every brick type × thickness. */
export function wallTypeOptions(bricks: readonly string[], thicknesses: readonly string[]) {
    return bricks.flatMap(b => thicknesses.map(t => ({ value: `${b}|${t}`, label: `${b} ${t}` })));
}
