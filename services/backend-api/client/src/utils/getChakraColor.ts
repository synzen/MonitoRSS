/**
 * @param color A color string such as red.500
 * @returns Chakra's color string
 */
const getChakraColor = (color: string) => `var(--chakra-colors-${color.replace(".", "-")})`;

export default getChakraColor;
