/**
 * PURE TYPESCRIPT STANDALONE QR CODE GENERATOR
 *
 * Generates standard ISO/IEC 18004 compliant QR Code module matrices (boolean[][])
 * 100% offline, zero external dependencies, runs seamlessly in React Native & Web.
 */

// Galois Field GF(256) log and antilog tables for Reed-Solomon computation
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    EXP_TABLE[i + 255] = val;
    LOG_TABLE[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
  LOG_TABLE[0] = 0;
})();

function gMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

// Generate Reed-Solomon error correction polynomial of degree `ecCount`
function rsGeneratorPolynomial(ecCount: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < ecCount; i++) {
    const nextPoly = new Uint8Array(poly.length + 1);
    const factor = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gMul(poly[j], factor);
      nextPoly[j + 1] ^= poly[j];
    }
    poly = nextPoly;
  }
  return poly;
}

// Compute Reed-Solomon parity bytes
function rsCalculateRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const genPoly = rsGeneratorPolynomial(ecCount);
  const remainder = new Uint8Array(ecCount);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gMul(genPoly[j], factor);
    }
    remainder[ecCount - 1] = gMul(genPoly[ecCount - 1], factor);
  }

  return remainder;
}

// QR Code Version specs (Version 4: 33x33 matrix, ECC Level L, 80 total codewords: 62 data, 18 EC)
// Version 6: 41x41 matrix, ECC Level L, 172 total codewords: 136 data, 27 EC in 2 blocks (68 data + 27 EC each)
// For patient medical briefs (typically 80-160 chars), Version 6 is optimal.
const V6_SIZE = 41;
const V6_TOTAL_CODEWORDS = 172;
const V6_DATA_CODEWORDS = 136;
const V6_EC_CODEWORDS = 36; // 18 per block for 2 blocks

export function generateQrMatrix(text: string): boolean[][] {
  const matrix: (boolean | null)[][] = Array.from({ length: V6_SIZE }, () =>
    Array(V6_SIZE).fill(null)
  );

  // 1. Finder patterns at 3 corners
  function placeFinder(startX: number, startY: number) {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const px = startX + x;
        const py = startY + y;
        if (px < 0 || px >= V6_SIZE || py < 0 || py >= V6_SIZE) continue;

        if (x >= 0 && x <= 6 && y >= 0 && y <= 6) {
          if (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) {
            matrix[py][px] = true;
          } else {
            matrix[py][px] = false;
          }
        } else {
          matrix[py][px] = false; // separator
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(V6_SIZE - 7, 0);
  placeFinder(0, V6_SIZE - 7);

  // 2. Alignment patterns for Version 6: centers at 6, 22, 34
  const alignCoords = [6, 22, 34];
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      if (matrix[r][c] !== null) continue; // avoid finder overlaps
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const isBlack = Math.max(Math.abs(x), Math.abs(y)) !== 1;
          matrix[r + y][c + x] = isBlack;
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < V6_SIZE - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[V6_SIZE - 8][8] = true;

  // 4. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][V6_SIZE - 1 - i] = false;
    matrix[V6_SIZE - 1 - i][8] = false;
  }

  // 5. Encode Data (Byte Mode 0100)
  const utf8Bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let charCode = text.charCodeAt(i);
    if (charCode < 0x80) {
      utf8Bytes.push(charCode);
    } else if (charCode < 0x800) {
      utf8Bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else {
      utf8Bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
    }
  }

  // Cap data to capacity
  const maxBytes = V6_DATA_CODEWORDS - 3;
  const truncated = utf8Bytes.slice(0, maxBytes);

  // Bit buffer
  const bits: number[] = [];
  function pushBits(val: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // Mode: 0100 (Byte), Count: 8 bits in V6
  pushBits(0b0100, 4);
  pushBits(truncated.length, 8);
  for (const b of truncated) {
    pushBits(b, 8);
  }
  // Terminator
  pushBits(0b0000, 4);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Pad bytes up to capacity with 0xEC, 0x11
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i + b];
    }
    dataBytes.push(byteVal);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < V6_DATA_CODEWORDS) {
    dataBytes.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Split into 2 blocks (68 data bytes each) & calculate 18 EC bytes each
  const block1Data = new Uint8Array(dataBytes.slice(0, 68));
  const block2Data = new Uint8Array(dataBytes.slice(68, 136));
  const block1Ec = rsCalculateRemainder(block1Data, 18);
  const block2Ec = rsCalculateRemainder(block2Data, 18);

  // Interleave data codewords then EC codewords
  const finalCodewords: number[] = [];
  for (let i = 0; i < 68; i++) {
    finalCodewords.push(block1Data[i]);
    finalCodewords.push(block2Data[i]);
  }
  for (let i = 0; i < 18; i++) {
    finalCodewords.push(block1Ec[i]);
    finalCodewords.push(block2Ec[i]);
  }

  // Convert codewords to final bitstream
  const finalBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let b = 7; b >= 0; b--) {
      finalBits.push((cw >> b) & 1);
    }
  }
  // Add remainder bits (7 for Version 6)
  for (let r = 0; r < 7; r++) finalBits.push(0);

  // 6. Place bits in zig-zag pattern
  let bitIndex = 0;
  let directionUp = true;

  for (let rightCol = V6_SIZE - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5; // skip vertical timing line

    const rowRange = directionUp
      ? Array.from({ length: V6_SIZE }, (_, i) => V6_SIZE - 1 - i)
      : Array.from({ length: V6_SIZE }, (_, i) => i);

    for (const row of rowRange) {
      for (const col of [rightCol, rightCol - 1]) {
        if (matrix[row][col] === null) {
          const bit = bitIndex < finalBits.length ? finalBits[bitIndex] : 0;
          bitIndex++;
          // Standard mask 0: (row + col) % 2 === 0
          const maskInvert = (row + col) % 2 === 0;
          matrix[row][col] = maskInvert ? bit === 0 : bit === 1;
        }
      }
    }
    directionUp = !directionUp;
  }

  // 7. Format Information (ECC Level L = 01, Mask 0 = 000 -> 01000 + BCH -> 0x77c4 with mask 0x5412)
  const FORMAT_BITS = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  const formatCoordsTopLeft: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  const formatCoordsOther: [number, number][] = [
    [V6_SIZE - 1, 8], [V6_SIZE - 2, 8], [V6_SIZE - 3, 8], [V6_SIZE - 4, 8],
    [V6_SIZE - 5, 8], [V6_SIZE - 6, 8], [V6_SIZE - 7, 8],
    [8, V6_SIZE - 8], [8, V6_SIZE - 7], [8, V6_SIZE - 6], [8, V6_SIZE - 5],
    [8, V6_SIZE - 4], [8, V6_SIZE - 3], [8, V6_SIZE - 2], [8, V6_SIZE - 1]
  ];

  for (let i = 0; i < 15; i++) {
    const bit = FORMAT_BITS[i] === 1;
    const [r1, c1] = formatCoordsTopLeft[i];
    matrix[r1][c1] = bit;
    const [r2, c2] = formatCoordsOther[i];
    matrix[r2][c2] = bit;
  }

  return matrix.map((row) => row.map((cell) => cell ?? false));
}
