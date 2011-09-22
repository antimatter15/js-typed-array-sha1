var position = 0;

onmessage = function(e){
  var file = e.data;
  initialize();
  position = 0;
  loadChunk(file);
}

var q = 0;

function loadChunk(file){
  var fr = new FileReader();
  var amount = 1024 * 1024; //it has to be a multiple of 512 bits (a multiple of 64 bytes)
  
  var size = file.size;
  var realsize = Math.ceil((size/4 + 3)/16) * 16 * 4;
  fr.onload = function(){
    var chunk = fr.result.byteLength;
    if(chunk < amount){
      blocks = new Uint8Array(Math.ceil((fr.result.byteLength/4 + 3)/16) * 16 * 4);
      blocks.set(new Uint8Array(fr.result), 0);
      blocks[fr.result.byteLength] = 0x80;
      blocks = new Uint32Array(blocks.buffer);

      for(var i = Math.ceil(chunk/4) + 1; i--;)
        blocks[i] = endian_swap(blocks[i]);
      
      blocks[blocks.length - 2] = Math.floor(((size)*8) / Math.pow(2, 32));
      blocks[blocks.length - 1] = ((size)*8) & 0xffffffff;
    }else{
      blocks = new Uint32Array(fr.result);
      for(var i = blocks.length;i--;)
        blocks[i] = endian_swap(blocks[i]);
    }
    for(var n = 0; n < blocks.length; n+= 16){
      W.set(blocks.subarray(n, n+16));
      sha_transform();
      var processed = position - amount + (n+16) * 4;
      if(processed == realsize || q++ % 1547 == 0){
        postMessage({hash: getHexValue(), processed: processed, total: realsize})
      }
    }
    if(file.size > position) loadChunk(file);
  }
  fr.readAsArrayBuffer(file.webkitSlice(position, position+amount));
  position += amount;
}


function getHexValue(){
  return toHexStr(H[0]) + toHexStr(H[1]) + toHexStr(H[2]) + toHexStr(H[3]) + toHexStr(H[4]);
}

function endian_swap(x){
  return (
    (x>>>24) | 
    ((x<<8) & 0x00FF0000) |
    ((x>>>8) & 0x0000FF00) |
    (x<<24)
  )
}
var W = new Uint32Array(80);
var Z = new Uint32Array(6);
var K = new Uint32Array([0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6]);
var H;

function initialize(){
  H = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
}



function sha_transform(){
  for (var t=16; t<80; t++) W[t] = rol32(W[t-3] ^ W[t-8] ^ W[t-14] ^ W[t-16], 1);
  
  Z[1] = H[0];
  Z[2] = H[1];
  Z[3] = H[2];
  Z[4] = H[3];
  Z[5] = H[4];
  
  for (t = 0; t < 20; t++) {
    Z[0] = (rol32(Z[1],5) + f1(Z[2],Z[3],Z[4]) + Z[5] + K[0] + W[t]) ;
    Z[5] = Z[4];
    Z[4] = Z[3];
    Z[3] = rol32(Z[2], 30);
    Z[2] = Z[1];
    Z[1] = Z[0];
  }
  
  for (; t < 40; t ++) {
    Z[0] = (rol32(Z[1],5) + (Z[2]^Z[3]^Z[4]) + Z[5] + K[1] + W[t]) ;
    Z[5] = Z[4];
    Z[4] = Z[3];
    Z[3] = rol32(Z[2], 30);
    Z[2] = Z[1];
    Z[1] = Z[0];
  }

  for (; t < 60; t ++) {
    Z[0] = (rol32(Z[1],5) + f3(Z[2],Z[3],Z[4]) + Z[5] + K[2] + W[t]) ;
    Z[5] = Z[4];
    Z[4] = Z[3];
    Z[3] = rol32(Z[2], 30);
    Z[2] = Z[1];
    Z[1] = Z[0];
  }
  
  for (; t < 80; t ++) {
    Z[0] = (rol32(Z[1],5) + (Z[2]^Z[3]^Z[4]) + Z[5] + K[3] + W[t]) ;
    Z[5] = Z[4];
    Z[4] = Z[3];
    Z[3] = rol32(Z[2], 30);
    Z[2] = Z[1];
    Z[1] = Z[0];
  }

  H[0] += Z[1]
  H[1] += Z[2]
  H[2] += Z[3]
  H[3] += Z[4]
  H[4] += Z[5]
  
  //console.log(toHexStr(H[0]) + toHexStr(H[1]) + toHexStr(H[2]) + toHexStr(H[3]) + toHexStr(H[4]));
}


//TODO: benchmark to see which is faster
function f1(x,y,z){return (x & y) ^ (~x & z)}
function f3(x,y,z){return (x & y) ^ (x & z) ^ (y & z)}

function $f1(x,y,z){ return  (z ^ (x & (y ^ z)))	}
function $f3(x,y,z){return ((x & y) + (z & (x ^ y)))}


function f2(x,y,z){return (x ^ y ^ z)	}


rol32 = function(x, n) {
  return (x<<n)|(x>>>(32-n));
}


toHexStr = function(n) {
  var s="", v;
  for (var i=7; i>=0; i--) { v = (n>>>(i*4)) & 0xf; s += v.toString(16); }
  return s;
}

