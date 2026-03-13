/**
 * Compress audio Blob to low-bitrate MP3 using lamejs.
 * Falls back to the original blob if encoding fails (e.g., unsupported format).
 */
export async function compressToMp3(blob: Blob): Promise<Blob> {
  try {
    const { Mp3Encoder } = await import("lamejs");

    // Decode audio blob to PCM via Web Audio API
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();

    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const kbps = 64; // Low bitrate for speech — saves bandwidth

    const encoder = new Mp3Encoder(channels, sampleRate, kbps);
    const mp3Chunks: Uint8Array[] = [];

    // Get PCM data as Int16
    const left = floatTo16Bit(audioBuffer.getChannelData(0));
    const right = channels > 1 ? floatTo16Bit(audioBuffer.getChannelData(1)) : undefined;

    // Encode in chunks of 1152 samples (MP3 frame size)
    const SAMPLES_PER_FRAME = 1152;
    for (let i = 0; i < left.length; i += SAMPLES_PER_FRAME) {
      const leftChunk = left.subarray(i, i + SAMPLES_PER_FRAME);
      const rightChunk = right?.subarray(i, i + SAMPLES_PER_FRAME);

      const mp3buf = rightChunk
        ? encoder.encodeBuffer(leftChunk, rightChunk)
        : encoder.encodeBuffer(leftChunk);

      if (mp3buf.length > 0) {
        mp3Chunks.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.byteLength));
      }
    }

    // Flush remaining data
    const end = encoder.flush();
    if (end.length > 0) {
      mp3Chunks.push(new Uint8Array(end.buffer, end.byteOffset, end.byteLength));
    }

    return new Blob(mp3Chunks as BlobPart[], { type: "audio/mpeg" });
  } catch (err) {
    console.warn("MP3 compression failed, using original audio:", err);
    return blob;
  }
}

function floatTo16Bit(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}
