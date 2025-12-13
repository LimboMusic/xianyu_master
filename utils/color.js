const COLORS = [
  '#FF0000',
  '#FFFF00',
  '#FF00FF',
];

function getRandomColor() {
  return COLORS[Math.floor(Math.random()*COLORS.length)];
}

export { getRandomColor };