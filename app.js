// import Recorder from './recorder.js';

window.onload = () => {
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const downloadLink = document.getElementById('download');

  let audioContext, source, processor, rnnoiseWorker, recorder;

  startButton.addEventListener('click', async () => {
    console.log('Bouton démarrer cliqué');
    startButton.disabled = true;
    stopButton.disabled = false;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    audioContext = new AudioContext();
    source = audioContext.createMediaStreamSource(stream);

    const bufferSize = 8192;
    processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    rnnoiseWorker = new Worker(new URL('./rnnoise-worker.js', import.meta.url), { type: 'module' });
    rnnoiseWorker.postMessage({ type: 'init' });

    rnnoiseWorker.onmessage = (event) => {
      if (event.data.type === 'initialized') {
        console.log('RNNoise worker initialized');
      }
    };

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const output = event.outputBuffer.getChannelData(0);

      rnnoiseWorker.postMessage({ type: 'process', input });
      rnnoiseWorker.onmessage = (event) => {
        if (event.data.type === 'processed') {
          output.set(event.data.output);
        }
      };
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    // recorder = new Recorder(processor, { numChannels: 1 });
    // recorder.record();
  });

  stopButton.addEventListener('click', () => {
    console.log('Bouton arrêter cliqué');
    startButton.disabled = false;
    stopButton.disabled = true;

    source.disconnect();
    processor.disconnect();
    audioContext.close();

    recorder.stop();

    recorder.exportWAV((blob) => {
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.style.display = 'inline';
    });

    recorder.clear();
  });
};
