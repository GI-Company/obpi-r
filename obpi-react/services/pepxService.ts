// PEPx (Pixel Encoded Page eXtension) Service
// This service handles the steganographic encoding and decoding of data into raw pixel buffers.

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
const HEADER_SIZE = 4; // 32-bit integer to store the original data length

export class PEPxService {

  /**
   * Encodes binary data into a Uint8Array representing raw pixel data (RGBA).
   * The first 4 bytes of the pixel data store the length of the original data.
   * Subsequent bytes store the data itself in the R, G, and B channels.
   */
  public encode(data: Uint8Array): Uint8Array {
    const dataLength = data.length;
    // Calculate needed pixels: 1 for header + enough for data (3 bytes per pixel)
    const requiredPixels = 1 + Math.ceil(dataLength / 3);
    const side = Math.ceil(Math.sqrt(requiredPixels));
    const totalPixels = side * side;
    const buffer = new Uint8ClampedArray(totalPixels * 4); // RGBA

    // 1. Write header: Store the original data length in the first pixel's RGB channels
    buffer[0] = (dataLength >> 16) & 0xFF; // R
    buffer[1] = (dataLength >> 8) & 0xFF;  // G
    buffer[2] = dataLength & 0xFF;         // B
    buffer[3] = 255;                       // Alpha

    // 2. Write data: Pack the data into the R, G, B channels of subsequent pixels
    let bufferIndex = 4;
    for (let i = 0; i < dataLength; i += 3) {
      buffer[bufferIndex++] = data[i];
      buffer[bufferIndex++] = data[i + 1] || 0; // Use 0 if data ends
      buffer[bufferIndex++] = data[i + 2] || 0;
      buffer[bufferIndex++] = 255; // Alpha
    }

    // The result is a flat Uint8Array of RGBA values, not an ImageData object yet.
    return new Uint8Array(buffer.buffer);
  }

  /**
   * Decodes a string from a Uint8Array representing raw pixel data.
   */
  public decode(pixelData: Uint8Array): string {
    const rawData = this.decodeToBinary(pixelData);
    return textDecoder.decode(rawData);
  }
  
  /**
   * Decodes binary data from a Uint8Array representing raw pixel data.
   */
  public decodeToBinary(pixelData: Uint8Array): Uint8Array {
    if (pixelData.length < 4) return new Uint8Array(0);

    // 1. Read header: Extract original data length from the first pixel
    const dataLength = (pixelData[0] << 16) | (pixelData[1] << 8) | pixelData[2];
    const data = new Uint8Array(dataLength);

    // 2. Read data: Unpack from subsequent pixels
    let bufferIndex = 4;
    for (let i = 0; i < dataLength; i += 3) {
      data[i] = pixelData[bufferIndex++];
      if (i + 1 < dataLength) data[i + 1] = pixelData[bufferIndex++];
      if (i + 2 < dataLength) data[i + 2] = pixelData[bufferIndex++];
      bufferIndex++; // Skip alpha
    }

    return data;
  }

  /**
   * Decodes the raw pixel data into an ImageData object for rendering on a canvas.
   */
  public decodeToImageData(pixelData: Uint8Array): ImageData | null {
      if (!pixelData || pixelData.length === 0) return null;
      const requiredLength = pixelData.length;
      if (requiredLength % 4 !== 0) {
          console.error("PEPx: Invalid pixel data length.");
          return null;
      }
      const side = Math.sqrt(requiredLength / 4);
      if (side % 1 !== 0) {
          console.error("PEPx: Pixel data does not form a perfect square.");
          return null;
      }
      return new ImageData(new Uint8ClampedArray(pixelData.buffer), side, side);
  }
}
