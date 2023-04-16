window.onload = () => {
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const downloadLink = document.getElementById('download');

  let audioContext, source, processor, rnnoiseWorker, mediaRecorder, recordingStream, recordedChunks = [];
  const bufferSize = 8192; // Define bufferSize outside event listeners

  startButton.addEventListener('click', async () => {
    console.log('Bouton démarrer cliqué');
    startButton.disabled = true;
    stopButton.disabled = false;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    audioContext = new AudioContext();
    source = audioContext.createMediaStreamSource(stream);

    recordingStream = new MediaStream();
    recordingStream.addTrack(stream.getAudioTracks()[0]);
    mediaRecorder = new MediaRecorder(recordingStream);
    mediaRecorder.start();

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
  });

  stopButton.addEventListener('click', async () => {
    console.log('Bouton arrêter cliqué');
    startButton.disabled = false;
    stopButton.disabled = true;

    source.disconnect();
    audioContext.close();
    mediaRecorder.stop();

    const blob = new Blob(recordedChunks, { type: 'audio/wav' });
    const audioBuffer = await blob.arrayBuffer();
    const audioData = await audioContext.decodeAudioData(audioBuffer);
    
    const offlineAudioContext = new OfflineAudioContext(
      audioData.numberOfChannels,
      audioData.length,
      audioData.sampleRate
    );
    
    const sourceBuffer = offlineAudioContext.createBuffer(
      audioData.numberOfChannels,
      audioData.length,
      audioData.sampleRate
    );
    
    for (let i = 0; i < audioData.numberOfChannels; i++) {
      sourceBuffer.copyToChannel(audioData.getChannelData(i), i);
    }
    

    rnnoiseWorker = new Worker(new URL('./rnnoise-worker.js', import.meta.url), { type: 'module' });
    rnnoiseWorker.postMessage({ type: 'init' });

    rnnoiseWorker.onmessage = (event) => {
      if (event.data.type === 'INIT') {
        console.log('RNNoise worker initialized');
        rnnoiseWorker.postMessage({ type: 'process', input: sourceBuffer.getChannelData(0) });
      } else if (event.data.type === 'RESULT') {
        console.log('Processed audio frame:', event.data.payload);

        const outputBuffer = new Float32Array(event.data.payload);
        sourceBuffer.copyToChannel(outputBuffer, 0);

        const offlineSource = offlineAudioContext.createBufferSource();
        offlineSource.buffer = sourceBuffer;

        offlineSource.connect(offlineAudioContext.destination);
        offlineSource.start(0);

        offlineAudioContext.startRendering().then(renderedBuffer => {
          const audioBlob = new Blob([bufferToWave(renderedBuffer, 0, renderedBuffer.length)], { type: 'audio/wav' });
          const url = URL.createObjectURL(audioBlob);
          downloadLink.href = url;
          downloadLink.style.display = 'inline';
        });
      }
    };
  });

  function bufferToWave(abuffer, offset, len) {
    let numOfChan = abuffer.numberOfChannels;
    let length = len * numOfChan * 2 + 44;
    let buffer = new ArrayBuffer(length);
    let view = new DataView(buffer);
    let channels = [];
    let i;
    let sample;
    let pos = 0;

    for (i = 0; i < numOfChan; i++) {
      channels.push(abuffer.getChannelData(i));
    }

    setUint32(0, 0x52494646); // "RIFF"
    setUint32(4, length - 8); // file length -
  setUint32(8, 0x57415645); // "WAVE"

  setUint32(12, 0x666d7420); // "fmt " chunk
  setUint32(16, 16); // length = 16
  setUint16(20, 1); // PCM format
  setUint16(22, numOfChan);
  setUint32(24, abuffer.sampleRate);
  setUint32(28, abuffer.sampleRate * 2 * numOfChan); // avg bytes/sec
  setUint16(32, numOfChan * 2); // block-align
  setUint16(34, 16); // 16-bit

  setUint32(36, 0x64617461); // "data" - chunk
  setUint32(40, length - pos - 44); // chunk length

  for (i = 0; i < len; i++) {
    for (let channel = 0; channel < numOfChan; channel++) {
      sample = Math.max(-1, Math.min(1, channels[channel][i + offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos + channel * 2, sample, true);
    }
    pos += numOfChan * 2;
  }

  function setUint16(pos, val) {
    view.setUint16(pos, val, true);
  }

  function setUint32(pos, val) {
    view.setUint32(pos, val, true);
  }

  return buffer;
}
}
