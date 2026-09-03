class Canvas {
  constructor(width = 300, height = 150) {
    this.width = width;
    this.height = height;
  }
  getContext(type) {
    return {
      font: '',
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
      fillText: () => {},
      measureText: () => ({ width: 0 }),
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
      fillRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      rect: () => {},
    };
  }
  toBuffer() {
    return Buffer.alloc(0);
  }
  toDataURL() {
    return 'data:image/png;base64,';
  }
}

class Image {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.src = '';
    this.onload = null;
    this.onerror = null;
  }
}

function createCanvas(width, height) {
  return new Canvas(width, height);
}

function loadImage() {
  return Promise.resolve(new Image());
}

module.exports = {
  Canvas,
  Image,
  createCanvas,
  loadImage,
  default: { Canvas, Image, createCanvas, loadImage }
};
