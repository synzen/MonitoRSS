export const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunkedArray: T[][] = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunkedArray.push(array.slice(i, i + chunkSize));
  }

  return chunkedArray;
};
