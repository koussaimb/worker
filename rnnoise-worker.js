import RNNoise from './rnnoise-wasm/dist/rnnoise-sync.js';

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  if (type === 'INIT') {
    const rnnoise = await RNNoise();

    self.postMessage({ type: 'INIT', payload: 'RNNoise worker initialized' });
  } else if (type === 'PROCESS') {
    console.log('Processing audio frame in worker'); // Ajout d'un message de débogage
    const { input } = payload;

    // Create input and output arrays
    const inputArray = new Float32Array(input);
    const outputArray = new Float32Array(input.length);

    // Process the input
    rnnoise.process(inputArray, outputArray);

    // Send the processed output back to the main thread
    self.postMessage({ type: 'RESULT', payload: outputArray });
  }
};
