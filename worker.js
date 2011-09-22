var position = 0;
var size = 0;
var q = 0;
var amount = 1024 * 1024; //it has to be a multiple of 512 bits (a multiple of 64 bytes)

var is_little_endian = !!(new Uint8Array(new Uint32Array([1]).buffer)[0]);
//Typed Arrays have the endianness of the system, SHA1 is big-endian but x86 is little-endian :(


function fileSlice(file, start, length){
  var end = length + start;
  if(file.mozSlice){
    return file.mozSlice(start, end);
  }else if(file.webkitSlice){
    return file.webkitSlice(start, end);
  }
}

onmessage = function(e){
  var d = e.data;
  
  if(d instanceof ArrayBuffer){ //its an array buffer!
    processArrayBuffer(d, size);
    if(size > position){
      postMessage({action: 'requestChunk', amount: amount, position: position});
      position += amount;
    }
  }else{
    initialize();
    position = 0;
    size = d.size;
    if(typeof FileReader == 'function'){
      loadChunk(d.file);
    }else{  //Firefox doesn't support FileReader inside WebWorkers
      postMessage({action: 'requestChunk', position: position, amount: amount});
      position += amount;
    }
  }
}

function loadChunk(file){
  var fr = new FileReader();
  fr.onload = function(){
    processArrayBuffer(fr.result, size);
    if(size > position) loadChunk(file);
  }
  
  fr.readAsArrayBuffer(fileSlice(file, position, amount));
  position += amount;
}

function processArrayBuffer(buffer, size){
  var chunk = buffer.byteLength;
  if(chunk < amount){
    blocks = new Uint8Array(Math.ceil((buffer.byteLength/4 + 3)/16) * 16 * 4);
    blocks.set(new Uint8Array(buffer), 0);
    blocks[buffer.byteLength] = 0x80;
    blocks = new Uint32Array(blocks.buffer);
    if(is_little_endian)
      for(var i = Math.ceil(chunk/4) + 1; i--;)
        blocks[i] = endian_swap(blocks[i]);
    
    blocks[blocks.length - 2] = Math.floor(((size)*8) / Math.pow(2, 32));
    blocks[blocks.length - 1] = ((size)*8) & 0xffffffff;
  }else{
    blocks = new Uint32Array(buffer);
    if(is_little_endian)
      for(var i = blocks.length;i--;)
        blocks[i] = endian_swap(blocks[i]);
  }
  for(var n = 0; n < blocks.length; n+= 16){
    W.set(blocks.subarray(n, n+16));
    sha_transform();
    if(new Date - q > 121){
      var processed = position - amount + (n+16) * 4;
      postMessage({hash: getHexValue(), processed: processed});
      q = new Date;
    }
  }
  var processed = position - amount + blocks.length * 4;
  postMessage({hash: getHexValue(), processed: processed});
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

