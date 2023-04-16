import RNNoise from './rnnoise-wasm/dist/rnnoise-sync.js';

let rnnoise;

self.onmessage = async (event) => {
  if (event.data.type === 'init') {
    rnnoise = new RNNoise({ ready: 1 });
    console.log('on est la la team');
    self.postMessage({ type: 'initialized' });
  } else if (event.data.type === 'process') {
    const input = event.data.input;
    console.log('input:', input);
    const output = new Float32Array(input.length);

    const frameSize = 960; // ajustez cette valeur en fonction du nombre de canaux (480 pour mono, 960 pour stéréo)
    const paddedInputLength = Math.ceil(input.length / frameSize) * frameSize;
    const paddedInput = new Float32Array(paddedInputLength);
    paddedInput.set(input);
    paddedInput.fill(0, input.length);
    console.log('paddedInput:', paddedInput);

    const inputPtr = rnnoise._malloc(paddedInputLength * 4);
    rnnoise.HEAPF32.set(paddedInput, inputPtr / 4);
    console.log('inputPtr:', inputPtr);

    const outputPtr = rnnoise._malloc(paddedInputLength * 4);
    console.log('outputPtr:', outputPtr);

    for (let i = 0; i < paddedInputLength; i += frameSize) {
      console.log('processing frame:', i);
      rnnoise._rnnoise_process_frame(rnnoise._state, outputPtr + i * 4, inputPtr + i * 4);
    }

    output.set(rnnoise.HEAPF32.subarray(outputPtr / 4, outputPtr / 4 + paddedInputLength));
    console.log('output:', output);

    rnnoise._free(inputPtr);
    rnnoise._free(outputPtr);

    self.postMessage({ type: 'processed', output: output.subarray(0, input.length) });
  }
};
