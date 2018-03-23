/*
 *
 * This is a slightly modified copy of https://github.com/phoboslab/js-hqx
 * I only kept hq2x, see original github repo for hq3x and hq4x.
 * Added blackToAlpha option to switch channels before returning
 *
 * -------------------------------------------------------------
 *
 * Copyright (C) 2003 Maxim Stepin ( maxst@hiend3d.com )
 *
 * Copyright (C) 2010 Cameron Zemek ( grom@zeminvaders.net )
 *
 * Copyright (C) 2010 Dominic Szablewski ( mail@phoboslab.org )
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA
 */
let _src = null;
let _dest = null;
const _MASK_2 = 0x00FF00;
const _MASK_13 = 0xFF00FF;
const _Ymask = 0x00FF0000;
const _Umask = 0x0000FF00;
const _Vmask = 0x000000FF;
const _trY = 0x00300000;
const _trU = 0x00000700;
const _trV = 0x00000006;

const _Math = window.Math; // global to local. SHALL NOT cache abs directly (http://jsperf.com/math-vs-global/2)

const _RGBtoYUV = c => {
  const r = (c & 0xFF0000) >> 16;
  const g = (c & 0x00FF00) >> 8;
  const b = c & 0x0000FF;
  return (( /*y=*/ (0.299 * r + 0.587 * g + 0.114 * b | 0)) << 16) +
    (( /*u=*/ ((-0.169 * r - 0.331 * g + 0.5 * b) + 128 | 0)) << 8) +
    ( /*v=*/ ((0.5 * r - 0.419 * g - 0.081 * b) + 128 | 0));
};

const _Diff = (w1, w2) => {
  // Mask against RGB_MASK to discard the alpha channel
  const YUV1 = _RGBtoYUV(w1);
  const YUV2 = _RGBtoYUV(w2);
  return ((_Math.abs((YUV1 & _Ymask) - (YUV2 & _Ymask)) > _trY) ||
    (_Math.abs((YUV1 & _Umask) - (YUV2 & _Umask)) > _trU) ||
    (_Math.abs((YUV1 & _Vmask) - (YUV2 & _Vmask)) > _trV));
};

/* Interpolate functions */

const _Interp1 = (pc, c1, c2) => {
  //*pc = (c1*3+c2) >> 2;
  if (c1 === c2) {
    _dest[pc] = c1;
    return;
  }
  _dest[pc] = ((((c1 & _MASK_2) * 3 + (c2 & _MASK_2)) >> 2) & _MASK_2) +
    ((((c1 & _MASK_13) * 3 + (c2 & _MASK_13)) >> 2) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};

const _Interp2 = (pc, c1, c2, c3) => {
  //*pc = (c1*2+c2+c3) >> 2;
  _dest[pc] = (((((c1 & _MASK_2) << 1) + (c2 & _MASK_2) + (c3 & _MASK_2)) >> 2) & _MASK_2) +
    (((((c1 & _MASK_13) << 1) + (c2 & _MASK_13) + (c3 & _MASK_13)) >> 2) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};

const _Interp3 = (pc, c1, c2) => {
  //*pc = (c1*7+c2)/8;
  if (c1 === c2) {
    _dest[pc] = c1;
    return;
  }
  _dest[pc] = ((((c1 & _MASK_2) * 7 + (c2 & _MASK_2)) >> 3) & _MASK_2) +
    ((((c1 & _MASK_13) * 7 + (c2 & _MASK_13)) >> 3) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};

const _Interp4 = (pc, c1, c2, c3) => {
  //*pc = (c1*2+(c2+c3)*7)/16;
  _dest[pc] = (((((c1 & _MASK_2) << 1) + (c2 & _MASK_2) * 7 + (c3 & _MASK_2) * 7) >> 4) & _MASK_2) +
    (((((c1 & _MASK_13) << 1) + (c2 & _MASK_13) * 7 + (c3 & _MASK_13) * 7) >> 4) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};

const _Interp5 = (pc, c1, c2) => {
  //*pc = (c1+c2) >> 1;
  if (c1 === c2) {
    _dest[pc] = c1;
    return;
  }
  _dest[pc] = ((((c1 & _MASK_2) + (c2 & _MASK_2)) >> 1) & _MASK_2) +
    ((((c1 & _MASK_13) + (c2 & _MASK_13)) >> 1) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};

const _Interp6 = (pc, c1, c2, c3) => {
  //*pc = (c1*5+c2*2+c3)/8;
  _dest[pc] = ((((c1 & _MASK_2) * 5 + ((c2 & _MASK_2) << 1) + (c3 & _MASK_2)) >> 3) & _MASK_2) +
    ((((c1 & _MASK_13) * 5 + ((c2 & _MASK_13) << 1) + (c3 & _MASK_13)) >> 3) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};

const _Interp7 = (pc, c1, c2, c3) => {
  //*pc = (c1*6+c2+c3)/8;
  _dest[pc] = ((((c1 & _MASK_2) * 6 + (c2 & _MASK_2) + (c3 & _MASK_2)) >> 3) & _MASK_2) +
    ((((c1 & _MASK_13) * 6 + (c2 & _MASK_13) + (c3 & _MASK_13)) >> 3) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};

const _Interp8 = (pc, c1, c2) => {
  //*pc = (c1*5+c2*3)/8;
  if (c1 === c2) {
    _dest[pc] = c1;
    return;
  }
  _dest[pc] = ((((c1 & _MASK_2) * 5 + (c2 & _MASK_2) * 3) >> 3) & _MASK_2) +
    ((((c1 & _MASK_13) * 5 + (c2 & _MASK_13) * 3) >> 3) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};

const _Interp9 = (pc, c1, c2, c3) => {
  //*pc = (c1*2+(c2+c3)*3)/8;
  _dest[pc] = (((((c1 & _MASK_2) << 1) + (c2 & _MASK_2) * 3 + (c3 & _MASK_2) * 3) >> 3) & _MASK_2) +
    (((((c1 & _MASK_13) << 1) + (c2 & _MASK_13) * 3 + (c3 & _MASK_13) * 3) >> 3) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};

const _Interp10 = (pc, c1, c2, c3) => {
  //*pc = (c1*14+c2+c3)/16;
  _dest[pc] = ((((c1 & _MASK_2) * 14 + (c2 & _MASK_2) + (c3 & _MASK_2)) >> 4) & _MASK_2) +
    ((((c1 & _MASK_13) * 14 + (c2 & _MASK_13) + (c3 & _MASK_13)) >> 4) & _MASK_13);

  _dest[pc] |= (c1 & 0xFF000000);
};


const getVendorAttribute = (el, attr) => {
  const uc = attr.charAt(0).toUpperCase() + attr.substr(1);
  return el[attr] || el[`ms${uc}`] || el[`moz${uc}`] || el[`webkit${uc}`] || el[`o${uc}`];
};


// This function normalizes getImageData to extract the real, actual
// pixels from an image. The naive method recently failed on retina
// devices with a backgingStoreRatio != 1
const getImagePixels = (image, x, y, width, height) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const ratio = getVendorAttribute(ctx, 'backingStorePixelRatio') || 1;
  ctx.getImageDataHD = getVendorAttribute(ctx, 'getImageDataHD');

  const realWidth = image.width / ratio;
  const realHeight = image.height / ratio;

  canvas.width = Math.ceil(realWidth);
  canvas.height = Math.ceil(realHeight);

  ctx.drawImage(image, 0, 0, realWidth, realHeight);

  return (ratio === 1) ?
    ctx.getImageData(x, y, width, height) :
    ctx.getImageDataHD(x, y, width, height);
};

// We can only scale with a factor of 2, see https://github.com/phoboslab/js-hqx for methods to scale 3 and 4
export default function hqx (img, blackToAlpha) {
  const scale = 2
  let orig;
  let origCtx;
  let scaled;
  let origPixels;
  if (img instanceof HTMLCanvasElement) {
    orig = img;
    origCtx = orig.getContext('2d');
    scaled = orig;
    origPixels = origCtx.getImageData(0, 0, orig.width, orig.height).data;
  } else {
    origPixels = getImagePixels(img, 0, 0, img.width, img.height).data;
    scaled = document.createElement('canvas');
  }


  // pack RGBA colors into integers
  const count = img.width * img.height;
  let src = _src = new Array(count);
  let dest = _dest = new Array(count * scale * scale);
  let index;
  for (let i = 0; i < count; i++) {
    src[i] = (origPixels[(index = i << 2) + 3] << 24) +
      (origPixels[index + 2] << 16) +
      (origPixels[index + 1] << 8) +
      origPixels[index];
  }

  // This is where the magic happens
  hq2x(img.width, img.height);

  scaled.width = img.width * scale;
  scaled.height = img.height * scale;

  const scaledCtx = scaled.getContext('2d');
  const scaledPixels = scaledCtx.getImageData(0, 0, scaled.width, scaled.height);
  const scaledPixelsData = scaledPixels.data;

  // unpack integers to RGBA
  let c;

  let a;
  const destLength = dest.length;
  if (blackToAlpha) {
    for (let j = 0; j < destLength; j++) {
      a = ((c = dest[j]) & 0xFF000000) >> 24;
      scaledPixelsData[(index = j << 2) + 3] = c & 0x000000FF; // Expect black/red image, set alpha to red value
      scaledPixelsData[index + 2] = 0;
      scaledPixelsData[index + 1] = 0;
      scaledPixelsData[index] = 255;
    }
  } else {
    for (let j = 0; j < destLength; j++) {
      a = ((c = dest[j]) & 0xFF000000) >> 24;
      scaledPixelsData[(index = j << 2) + 3] = a < 0 ? a + 256 : 0; // signed/unsigned :/
      scaledPixelsData[index + 2] = (c & 0x00FF0000) >> 16;
      scaledPixelsData[index + 1] = (c & 0x0000FF00) >> 8;
      scaledPixelsData[index] = c & 0x000000FF;
    }
  }
  _src = src = null;
  _dest = dest = null;
  scaledCtx.putImageData(scaledPixels, 0, 0);
  return scaled;
};


//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
// hq 2x

var hq2x = (width, height) => {
  let i;
  let j;
  let k;
  let prevline;
  let nextline;
  const w = [];

  const //dpL = width * 2, optimized
    dpL = width << 1;

  let dp = 0;
  let sp = 0;

  // internal to local optimization
  const Diff = _Diff;

  const Math = _Math;
  const RGBtoYUV = _RGBtoYUV;
  const Interp1 = _Interp1;
  const Interp2 = _Interp2;
  const Interp3 = _Interp3;
  const Interp4 = _Interp4;
  const Interp5 = _Interp5;
  const Interp6 = _Interp6;
  const Interp7 = _Interp7;
  const Interp8 = _Interp8;
  const Interp9 = _Interp9;
  const Interp10 = _Interp10;
  const src = _src;
  const dest = _dest;
  const MASK_2 = _MASK_2;
  const MASK_13 = _MASK_13;
  const Ymask = _Ymask;
  const Umask = _Umask;
  const Vmask = _Vmask;
  const trY = _trY;
  const trU = _trU;
  const trV = _trV;
  let YUV1;
  let YUV2;


  //   +----+----+----+
  //   |    |    |    |
  //   | w1 | w2 | w3 |
  //   +----+----+----+
  //   |    |    |    |
  //   | w4 | w5 | w6 |
  //   +----+----+----+
  //   |    |    |    |
  //   | w7 | w8 | w9 |
  //   +----+----+----+

  for (j = 0; j < height; j++) {
    prevline = j > 0 ? -width : 0;
    nextline = j < height - 1 ? width : 0;

    for (i = 0; i < width; i++) {
      w[2] = src[sp + prevline];
      w[5] = src[sp];
      w[8] = src[sp + nextline];

      if (i > 0) {
        w[1] = src[sp + prevline - 1];
        w[4] = src[sp - 1];
        w[7] = src[sp + nextline - 1];
      } else {
        w[1] = w[2];
        w[4] = w[5];
        w[7] = w[8];
      }

      if (i < width - 1) {
        w[3] = src[sp + prevline + 1];
        w[6] = src[sp + 1];
        w[9] = src[sp + nextline + 1];
      } else {
        w[3] = w[2];
        w[6] = w[5];
        w[9] = w[8];
      }

      let pattern = 0;
      let flag = 1;

      YUV1 = RGBtoYUV(w[5]);

      //for (k=1; k<=9; k++) optimized
      for (k = 1; k < 10; k++) // k<=9
      {
        if (k === 5) continue;

        if (w[k] !== w[5]) {
          YUV2 = RGBtoYUV(w[k]);
          if ((Math.abs((YUV1 & Ymask) - (YUV2 & Ymask)) > trY) ||
            (Math.abs((YUV1 & Umask) - (YUV2 & Umask)) > trU) ||
            (Math.abs((YUV1 & Vmask) - (YUV2 & Vmask)) > trV))
            pattern |= flag;
        }
        flag <<= 1;
      }

      switch (pattern) {
        case 0:
        case 1:
        case 4:
        case 32:
        case 128:
        case 5:
        case 132:
        case 160:
        case 33:
        case 129:
        case 36:
        case 133:
        case 164:
        case 161:
        case 37:
        case 165:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 2:
        case 34:
        case 130:
        case 162:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 16:
        case 17:
        case 48:
        case 49:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 64:
        case 65:
        case 68:
        case 69:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 8:
        case 12:
        case 136:
        case 140:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 3:
        case 35:
        case 131:
        case 163:
          {
            Interp1(dp, w[5], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 6:
        case 38:
        case 134:
        case 166:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 20:
        case 21:
        case 52:
        case 53:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 144:
        case 145:
        case 176:
        case 177:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 192:
        case 193:
        case 196:
        case 197:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 96:
        case 97:
        case 100:
        case 101:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 40:
        case 44:
        case 168:
        case 172:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 9:
        case 13:
        case 137:
        case 141:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 18:
        case 50:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 80:
        case 81:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 72:
        case 76:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 10:
        case 138:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 66:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 24:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 7:
        case 39:
        case 135:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 148:
        case 149:
        case 180:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 224:
        case 228:
        case 225:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 41:
        case 169:
        case 45:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 22:
        case 54:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 208:
        case 209:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 104:
        case 108:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 11:
        case 139:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 19:
        case 51:
          {
            if (Diff(w[2], w[6])) {
              Interp1(dp, w[5], w[4]);
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp6(dp, w[5], w[2], w[4]);
              Interp9(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 146:
        case 178:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
              Interp1(dp + dpL + 1, w[5], w[8]);
            } else {
              Interp9(dp + 1, w[5], w[2], w[6]);
              Interp6(dp + dpL + 1, w[5], w[6], w[8]);
            }
            Interp2(dp + dpL, w[5], w[8], w[4]);
            break;
          }
        case 84:
        case 85:
          {
            Interp2(dp, w[5], w[4], w[2]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + 1, w[5], w[2]);
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp6(dp + 1, w[5], w[6], w[2]);
              Interp9(dp + dpL + 1, w[5], w[6], w[8]);
            }
            Interp2(dp + dpL, w[5], w[7], w[4]);
            break;
          }
        case 112:
        case 113:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL, w[5], w[4]);
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp6(dp + dpL, w[5], w[8], w[4]);
              Interp9(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 200:
        case 204:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
              Interp1(dp + dpL + 1, w[5], w[6]);
            } else {
              Interp9(dp + dpL, w[5], w[8], w[4]);
              Interp6(dp + dpL + 1, w[5], w[8], w[6]);
            }
            break;
          }
        case 73:
        case 77:
          {
            if (Diff(w[8], w[4])) {
              Interp1(dp, w[5], w[2]);
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp6(dp, w[5], w[4], w[2]);
              Interp9(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 42:
        case 170:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
              Interp1(dp + dpL, w[5], w[8]);
            } else {
              Interp9(dp, w[5], w[4], w[2]);
              Interp6(dp + dpL, w[5], w[4], w[8]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 14:
        case 142:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
              Interp1(dp + 1, w[5], w[6]);
            } else {
              Interp9(dp, w[5], w[4], w[2]);
              Interp6(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 67:
          {
            Interp1(dp, w[5], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 70:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 28:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 152:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 194:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 98:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 56:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 25:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 26:
        case 31:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 82:
        case 214:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[4]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 88:
        case 248:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 74:
        case 107:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 27:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp1(dp + 1, w[5], w[3]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 86:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 216:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp1(dp + dpL, w[5], w[7]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 106:
          {
            Interp1(dp, w[5], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 30:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 210:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp1(dp + 1, w[5], w[3]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 120:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 75:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp1(dp + dpL, w[5], w[7]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 29:
          {
            Interp1(dp, w[5], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 198:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 184:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 99:
          {
            Interp1(dp, w[5], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 57:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 71:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 156:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 226:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 60:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 195:
          {
            Interp1(dp, w[5], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 102:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 153:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 58:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 83:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[4]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 92:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 202:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 78:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            Interp1(dp + 1, w[5], w[6]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 154:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 114:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[4]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 89:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 90:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 55:
        case 23:
          {
            if (Diff(w[2], w[6])) {
              Interp1(dp, w[5], w[4]);
              dest[dp + 1] = w[5];
            } else {
              Interp6(dp, w[5], w[2], w[4]);
              Interp9(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 182:
        case 150:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
              Interp1(dp + dpL + 1, w[5], w[8]);
            } else {
              Interp9(dp + 1, w[5], w[2], w[6]);
              Interp6(dp + dpL + 1, w[5], w[6], w[8]);
            }
            Interp2(dp + dpL, w[5], w[8], w[4]);
            break;
          }
        case 213:
        case 212:
          {
            Interp2(dp, w[5], w[4], w[2]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + 1, w[5], w[2]);
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp6(dp + 1, w[5], w[6], w[2]);
              Interp9(dp + dpL + 1, w[5], w[6], w[8]);
            }
            Interp2(dp + dpL, w[5], w[7], w[4]);
            break;
          }
        case 241:
        case 240:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL, w[5], w[4]);
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp6(dp + dpL, w[5], w[8], w[4]);
              Interp9(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 236:
        case 232:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
              Interp1(dp + dpL + 1, w[5], w[6]);
            } else {
              Interp9(dp + dpL, w[5], w[8], w[4]);
              Interp6(dp + dpL + 1, w[5], w[8], w[6]);
            }
            break;
          }
        case 109:
        case 105:
          {
            if (Diff(w[8], w[4])) {
              Interp1(dp, w[5], w[2]);
              dest[dp + dpL] = w[5];
            } else {
              Interp6(dp, w[5], w[4], w[2]);
              Interp9(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 171:
        case 43:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
              Interp1(dp + dpL, w[5], w[8]);
            } else {
              Interp9(dp, w[5], w[4], w[2]);
              Interp6(dp + dpL, w[5], w[4], w[8]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 143:
        case 15:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
              Interp1(dp + 1, w[5], w[6]);
            } else {
              Interp9(dp, w[5], w[4], w[2]);
              Interp6(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 124:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 203:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp1(dp + dpL, w[5], w[7]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 62:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 211:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[3]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 118:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[4]);
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 217:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp1(dp + dpL, w[5], w[7]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 110:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 155:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp1(dp + 1, w[5], w[3]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 188:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 185:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 61:
          {
            Interp1(dp, w[5], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 157:
          {
            Interp1(dp, w[5], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 103:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 227:
          {
            Interp1(dp, w[5], w[4]);
            Interp2(dp + 1, w[5], w[3], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 230:
          {
            Interp2(dp, w[5], w[1], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 199:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp2(dp + dpL, w[5], w[7], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 220:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 158:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 234:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 242:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[4]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 59:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 121:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 87:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[7], w[4]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 79:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp1(dp + 1, w[5], w[6]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 122:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 94:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 218:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 91:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 229:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 167:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 173:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 181:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 186:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 115:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[4]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 93:
          {
            Interp1(dp, w[5], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 206:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            Interp1(dp + 1, w[5], w[6]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 205:
        case 201:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            if (Diff(w[8], w[4])) {
              Interp1(dp + dpL, w[5], w[7]);
            } else {
              Interp7(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 174:
        case 46:
          {
            if (Diff(w[4], w[2])) {
              Interp1(dp, w[5], w[4]);
            } else {
              Interp7(dp, w[5], w[4], w[2]);
            }
            Interp1(dp + 1, w[5], w[6]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 179:
        case 147:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              Interp1(dp + 1, w[5], w[3]);
            } else {
              Interp7(dp + 1, w[5], w[2], w[6]);
            }
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 117:
        case 116:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp1(dp + dpL, w[5], w[4]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL + 1, w[5], w[9]);
            } else {
              Interp7(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 189:
          {
            Interp1(dp, w[5], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 231:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            Interp1(dp + dpL, w[5], w[4]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 126:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 219:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp1(dp + 1, w[5], w[3]);
            Interp1(dp + dpL, w[5], w[7]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 125:
          {
            if (Diff(w[8], w[4])) {
              Interp1(dp, w[5], w[2]);
              dest[dp + dpL] = w[5];
            } else {
              Interp6(dp, w[5], w[4], w[2]);
              Interp9(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + 1, w[5], w[2]);
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 221:
          {
            Interp1(dp, w[5], w[2]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + 1, w[5], w[2]);
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp6(dp + 1, w[5], w[6], w[2]);
              Interp9(dp + dpL + 1, w[5], w[6], w[8]);
            }
            Interp1(dp + dpL, w[5], w[7]);
            break;
          }
        case 207:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
              Interp1(dp + 1, w[5], w[6]);
            } else {
              Interp9(dp, w[5], w[4], w[2]);
              Interp6(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[7]);
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 238:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
              Interp1(dp + dpL + 1, w[5], w[6]);
            } else {
              Interp9(dp + dpL, w[5], w[8], w[4]);
              Interp6(dp + dpL + 1, w[5], w[8], w[6]);
            }
            break;
          }
        case 190:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
              Interp1(dp + dpL + 1, w[5], w[8]);
            } else {
              Interp9(dp + 1, w[5], w[2], w[6]);
              Interp6(dp + dpL + 1, w[5], w[6], w[8]);
            }
            Interp1(dp + dpL, w[5], w[8]);
            break;
          }
        case 187:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
              Interp1(dp + dpL, w[5], w[8]);
            } else {
              Interp9(dp, w[5], w[4], w[2]);
              Interp6(dp + dpL, w[5], w[4], w[8]);
            }
            Interp1(dp + 1, w[5], w[3]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 243:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[3]);
            if (Diff(w[6], w[8])) {
              Interp1(dp + dpL, w[5], w[4]);
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp6(dp + dpL, w[5], w[8], w[4]);
              Interp9(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 119:
          {
            if (Diff(w[2], w[6])) {
              Interp1(dp, w[5], w[4]);
              dest[dp + 1] = w[5];
            } else {
              Interp6(dp, w[5], w[2], w[4]);
              Interp9(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[4]);
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 237:
        case 233:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[2], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp1(dp + dpL, w[5], w[7]);
              0
            }
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 175:
        case 47:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp1(dp, w[5], w[4]);
              0
            }
            Interp1(dp + 1, w[5], w[6]);
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            break;
          }
        case 183:
        case 151:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp1(dp + 1, w[5], w[3]);
              0
            }
            Interp2(dp + dpL, w[5], w[8], w[4]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 245:
        case 244:
          {
            Interp2(dp, w[5], w[4], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            Interp1(dp + dpL, w[5], w[4]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp1(dp + dpL + 1, w[5], w[9]);
              0
            }
            break;
          }
        case 250:
          {
            Interp1(dp, w[5], w[4]);
            Interp1(dp + 1, w[5], w[3]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 123:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp1(dp + 1, w[5], w[3]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 95:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[7]);
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 222:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[7]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 252:
          {
            Interp2(dp, w[5], w[1], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp1(dp + dpL + 1, w[5], w[9]);
              0
            }
            break;
          }
        case 249:
          {
            Interp1(dp, w[5], w[2]);
            Interp2(dp + 1, w[5], w[3], w[2]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp1(dp + dpL, w[5], w[7]);
              0
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 235:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp2(dp + 1, w[5], w[3], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp1(dp + dpL, w[5], w[7]);
              0
            }
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 111:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp1(dp, w[5], w[4]);
              0
            }
            Interp1(dp + 1, w[5], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp2(dp + dpL + 1, w[5], w[9], w[6]);
            break;
          }
        case 63:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp1(dp, w[5], w[4]);
              0
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[8]);
            Interp2(dp + dpL + 1, w[5], w[9], w[8]);
            break;
          }
        case 159:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp1(dp + 1, w[5], w[3]);
              0
            }
            Interp2(dp + dpL, w[5], w[7], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 215:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp1(dp + 1, w[5], w[3]);
              0
            }
            Interp2(dp + dpL, w[5], w[7], w[4]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 246:
          {
            Interp2(dp, w[5], w[1], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            Interp1(dp + dpL, w[5], w[4]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp1(dp + dpL + 1, w[5], w[9]);
              0
            }
            break;
          }
        case 254:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp1(dp + dpL + 1, w[5], w[9]);
              0
            }
            break;
          }
        case 253:
          {
            Interp1(dp, w[5], w[2]);
            Interp1(dp + 1, w[5], w[2]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp1(dp + dpL, w[5], w[7]);
              0
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp1(dp + dpL + 1, w[5], w[9]);
              0
            }
            break;
          }
        case 251:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            Interp1(dp + 1, w[5], w[3]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp1(dp + dpL, w[5], w[7]);
              0
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 239:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp1(dp, w[5], w[4]);
              0
            }
            Interp1(dp + 1, w[5], w[6]);
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp1(dp + dpL, w[5], w[7]);
              0
            }
            Interp1(dp + dpL + 1, w[5], w[6]);
            break;
          }
        case 127:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp1(dp, w[5], w[4]);
              0
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp2(dp + 1, w[5], w[2], w[6]);
            }
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp2(dp + dpL, w[5], w[8], w[4]);
            }
            Interp1(dp + dpL + 1, w[5], w[9]);
            break;
          }
        case 191:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp1(dp, w[5], w[4]);
              0
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp1(dp + 1, w[5], w[3]);
              0
            }
            Interp1(dp + dpL, w[5], w[8]);
            Interp1(dp + dpL + 1, w[5], w[8]);
            break;
          }
        case 223:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp2(dp, w[5], w[4], w[2]);
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp1(dp + 1, w[5], w[3]);
              0
            }
            Interp1(dp + dpL, w[5], w[7]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp2(dp + dpL + 1, w[5], w[6], w[8]);
            }
            break;
          }
        case 247:
          {
            Interp1(dp, w[5], w[4]);
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp1(dp + 1, w[5], w[3]);
              0
            }
            Interp1(dp + dpL, w[5], w[4]);
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp1(dp + dpL + 1, w[5], w[9]);
              0
            }
            break;
          }
        case 255:
          {
            if (Diff(w[4], w[2])) {
              dest[dp] = w[5];
            } else {
              Interp1(dp, w[5], w[4]);
              0
            }
            if (Diff(w[2], w[6])) {
              dest[dp + 1] = w[5];
            } else {
              Interp1(dp + 1, w[5], w[3]);
              0
            }
            if (Diff(w[8], w[4])) {
              dest[dp + dpL] = w[5];
            } else {
              Interp1(dp + dpL, w[5], w[7]);
              0
            }
            if (Diff(w[6], w[8])) {
              dest[dp + dpL + 1] = w[5];
            } else {
              Interp1(dp + dpL + 1, w[5], w[9]);
              0
            }
            break;
          }
      }
      sp++;
      dp += 2;
    }
    dp += dpL;
  }
};