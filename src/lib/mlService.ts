import * as tf from '@tensorflow/tfjs';
import { SensorData } from './serial';

export interface TremorFeatures {
  rms: number;
  frequency: number;
  avgForce: number;
  variance: number;
  amplitude: number;
}

const WINDOW_SIZE = 40; // 2 seconds at 20Hz
const CHANNELS = 6; // ax, ay, az, gx, gy, gz

export class TremorMLService {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;
  private isModelTrained = false;
  private isTraining = false;

  /**
   * Initialize the CNN model. Loads from IndexedDB if available,
   * otherwise builds a new model.
   */
  async initModel() {
    try {
      this.model = await tf.loadLayersModel('indexeddb://tremor-cnn-model-v2');
      this.isModelLoaded = true;
      this.isModelTrained = true;
      console.log('Loaded existing CNN model from IndexedDB');
      
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'sparseCategoricalCrossentropy',
        metrics: ['accuracy']
      });
      return true;
    } catch (error) {
      console.log('Creating new CNN model for continuous learning');
      this.model = this.buildCNN();
      this.isModelLoaded = true;
      this.isModelTrained = false;
      return true;
    }
  }

  private buildCNN(): tf.LayersModel {
    const model = tf.sequential();
    
    model.add(tf.layers.conv1d({
      filters: 16,
      kernelSize: 3,
      activation: 'relu',
      inputShape: [WINDOW_SIZE, CHANNELS]
    }));
    model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
    
    model.add(tf.layers.conv1d({
      filters: 32,
      kernelSize: 3,
      activation: 'relu'
    }));
    model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
    
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.5 }));
    // 4 classes: Normal (0), Mild (1), Moderate (2), Severe (3)
    model.add(tf.layers.dense({ units: 4, activation: 'softmax' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'sparseCategoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Extract features from a window of sensor data.
   * This should match the preprocessing steps used in your Colab notebook.
   */
  extractFeatures(dataWindow: SensorData[], deviceType: 'mobile' | 'pen' | 'mmwave' | 'gpio' = 'mobile'): TremorFeatures {
    if (dataWindow.length < 10) {
      return { rms: 0, frequency: 0, avgForce: 0, variance: 0, amplitude: 0 };
    }

    if (deviceType === 'gpio') {
      // Calculate percentage of time spent in "Micro-Movement" (Tremor state = 2) versus normal resting
      const tremorStates = dataWindow.filter(d => d.gpioState === 2).length;
      const staticStates = dataWindow.filter(d => d.gpioState === 1).length;
      const gaitStates = dataWindow.filter(d => d.gpioState === 3).length;
      
      const isGrossMovement = gaitStates > tremorStates;
      const tremorRatio = tremorStates / dataWindow.length;
      
      // Map arbitrary amplitude based on the DSP states
      const amplitude = isGrossMovement ? 120 : (tremorRatio * 100);
      
      return { rms: tremorRatio * 10, frequency: isGrossMovement ? 1 : 5, avgForce: 0, variance: tremorRatio, amplitude };
    }

    const isMmWave = deviceType === 'mmwave' || dataWindow.some(d => d.phase !== 0 || d.amplitude !== 0);

    if (isMmWave) {
      const meanPhase = dataWindow.reduce((acc, d) => acc + d.phase, 0) / dataWindow.length;
      const meanAmp = dataWindow.reduce((acc, d) => acc + d.amplitude, 0) / dataWindow.length;
      
      const phaseDiffs = dataWindow.map(d => d.phase - meanPhase);
      
      let sumSqPhase = phaseDiffs.reduce((acc, val) => acc + (val * val), 0);
      let variance = sumSqPhase / phaseDiffs.length;
      let rms = Math.sqrt(variance);
      
      const dynAmps = dataWindow.map(d => Math.abs(d.amplitude - meanAmp));
      const amplitude = Math.max(...dynAmps);

      let zeroCrossings = 0;
      for (let i = 1; i < phaseDiffs.length; i++) {
        if (phaseDiffs[i] * phaseDiffs[i - 1] < 0) {
          zeroCrossings++;
        }
      }
      const durationSec = (dataWindow[dataWindow.length - 1].timestamp - dataWindow[0].timestamp) / 1000;
      const frequency = durationSec > 0 ? (zeroCrossings / 2) / durationSec : 0;

      return { rms, frequency, avgForce: 0, variance, amplitude };
    }

    // 1. Calculate the mean vector (DC component / Gravity or static posture)
    const meanX = dataWindow.reduce((acc, d) => acc + d.ax, 0) / dataWindow.length;
    const meanY = dataWindow.reduce((acc, d) => acc + d.ay, 0) / dataWindow.length;
    const meanZ = dataWindow.reduce((acc, d) => acc + d.az, 0) / dataWindow.length;

    // 2. Isolate dynamic acceleration (AC component / Tremor) by subtracting the mean
    const dynamicMagnitudes = dataWindow.map(d => 
      Math.sqrt(Math.pow(d.ax - meanX, 2) + Math.pow(d.ay - meanY, 2) + Math.pow(d.az - meanZ, 2))
    );

    // 3. Calculate RMS of the dynamic acceleration
    const sumSquared = dynamicMagnitudes.reduce((acc, val) => acc + (val * val), 0);
    const variance = sumSquared / dynamicMagnitudes.length;
    const rms = Math.sqrt(variance);

    // 4. Calculate Frequency using zero-crossings on the dynamic magnitude
    const meanDynMag = dynamicMagnitudes.reduce((a, b) => a + b, 0) / dynamicMagnitudes.length;
    
    let zeroCrossings = 0;
    
    if (deviceType === 'mobile') {
      // Apply a small hysteresis (deadband) to ignore tiny noise fluctuations around the mean
      const hysteresis = 0.05; // 0.05 m/s^2 deadband
      let isAbove = dynamicMagnitudes[0] > meanDynMag + hysteresis;
      
      for (let i = 1; i < dynamicMagnitudes.length; i++) {
        const mag = dynamicMagnitudes[i];
        if (isAbove && mag < meanDynMag - hysteresis) {
          zeroCrossings++;
          isAbove = false;
        } else if (!isAbove && mag > meanDynMag + hysteresis) {
          zeroCrossings++;
          isAbove = true;
        }
      }
    } else {
      // Pen: standard zero-crossing without hysteresis
      for (let i = 1; i < dynamicMagnitudes.length; i++) {
        if ((dynamicMagnitudes[i] - meanDynMag) * (dynamicMagnitudes[i - 1] - meanDynMag) < 0) {
          zeroCrossings++;
        }
      }
    }

    const durationSec = (dataWindow[dataWindow.length - 1].timestamp - dataWindow[0].timestamp) / 1000;
    // Frequency is (zero crossings / 2) divided by duration in seconds
    const frequency = durationSec > 0 ? (zeroCrossings / 2) / durationSec : 0;

    const avgForce = dataWindow.reduce((acc, d) => acc + d.fsr, 0) / dataWindow.length;
    
    const amplitude = Math.max(...dynamicMagnitudes);

    return { rms, frequency, avgForce, variance, amplitude };
  }

  private prepareTensor(dataWindow: SensorData[]): tf.Tensor3D | null {
    if (dataWindow.length < WINDOW_SIZE) return null;
    const slice = dataWindow.slice(-WINDOW_SIZE);
    const values = slice.map(d => [d.ax, d.ay, d.az, d.gx, d.gy, d.gz]);
    return tf.tensor3d([values], [1, WINDOW_SIZE, CHANNELS]);
  }

  /**
   * Run inference using the loaded CNN model or a fallback heuristic.
   * Returns a severity score (0 to 4).
   */
  async predictSeverity(dataWindow: SensorData[], features: TremorFeatures, deviceType: 'mobile' | 'pen' | 'mmwave' | 'gpio' = 'mobile'): Promise<number> {
    if (this.isModelLoaded && this.isModelTrained && this.model && deviceType !== 'mmwave' && deviceType !== 'gpio') {
      const inputTensor = this.prepareTensor(dataWindow);
      if (inputTensor) {
        try {
          const prediction = this.model.predict(inputTensor) as tf.Tensor;
          const scoreData = await prediction.data();
          
          inputTensor.dispose();
          prediction.dispose();
          
          // Expected value calculation: 0*p0 + 1*p1 + 2*p2 + 3*p3
          let expectedValue = 0;
          for (let i = 0; i < 4; i++) {
            expectedValue += i * scoreData[i];
          }
          // Scale 0-3 to 0-4 range to match heuristic
          return expectedValue * (4/3);
        } catch (error) {
          console.error('Inference error, falling back to heuristic:', error);
          if (inputTensor) inputTensor.dispose();
          return this.heuristicPrediction(features, deviceType);
        }
      }
    }
    return this.heuristicPrediction(features, deviceType);
  }

  /**
   * Train the CNN model on a recorded session to enable continuous learning.
   */
  async trainOnSession(sessionData: SensorData[], severityLabel: string) {
    if (!this.model || sessionData.length < WINDOW_SIZE) return;
    if (this.isTraining) return;
    
    this.isTraining = true;
    console.log(`Training CNN on new session data. Label: ${severityLabel}`);

    let labelIdx = 0;
    if (severityLabel === 'Mild') labelIdx = 1;
    if (severityLabel === 'Moderate') labelIdx = 2;
    if (severityLabel === 'Severe') labelIdx = 3;

    try {
      const inputs: number[][][] = [];
      const labels: number[] = [];

      // Slide window by 10 samples (0.5s) to augment data
      const step = 10;
      for (let i = 0; i <= sessionData.length - WINDOW_SIZE; i += step) {
        const slice = sessionData.slice(i, i + WINDOW_SIZE);
        const values = slice.map(d => [d.ax, d.ay, d.az, d.gx, d.gy, d.gz]);
        inputs.push(values);
        labels.push(labelIdx);
      }

      if (inputs.length === 0) {
        this.isTraining = false;
        return;
      }

      const xs = tf.tensor3d(inputs, [inputs.length, WINDOW_SIZE, CHANNELS]);
      const ys = tf.tensor1d(labels, 'int32');

      await this.model.fit(xs, ys, {
        epochs: 5,
        batchSize: 8,
        shuffle: true
      });

      xs.dispose();
      ys.dispose();

      await this.model.save('indexeddb://tremor-cnn-model-v2');
      this.isModelTrained = true;
      console.log('Model trained and saved successfully!');
    } catch (error) {
      console.error('Error training model:', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * A heuristic fallback to simulate the ML model's behavior.
   * Maps features to a 0-4 severity scale (similar to UPDRS).
   */
  public heuristicPrediction(features: TremorFeatures, deviceType: 'mobile' | 'pen' | 'mmwave' | 'gpio' = 'mobile'): number {
    let severity = 0;

    // Clinical tremor severity is determined by the amplitude (RMS acceleration), not frequency.
    // Frequency is used to classify the *type* of tremor (e.g., Parkinson's 4-6Hz, Essential 4-12Hz),
    // but the *severity* (disease level) is strictly based on how violent the shaking is (amplitude).
    
    // We use RMS (Root Mean Square) acceleration as it is the standard clinical metric 
    // for quantifying tremor severity, being more stable than peak amplitude.
    const rms = features.rms; // in m/s^2 (or radians/units for mmWave)

    if (deviceType === 'gpio') {
      // For GPIO binary inputs, RMS was mapped to tremor density * 10
      if (rms <= 0.5) severity = 0;
      else if (rms <= 2.0) severity = 1;
      else if (rms <= 5.0) severity = 2;
      else if (rms <= 8.0) severity = 3;
      else severity = 4;
    } else if (deviceType === 'mmwave') {
      // MMWave radar: phase shift variances (micro-Doppler)
      if (rms <= 0.5) {
        severity = 0; 
      } else if (rms <= 2.0) {
        severity = 1;
      } else if (rms <= 5.0) {
        severity = 2;
      } else if (rms <= 10.0) {
        severity = 3;
      } else {
        severity = 4;
      }
    } else if (deviceType === 'mobile') {
      // Mobile phone in hand. Heavier object, dampens acceleration.
      // Realistic clinical tremor RMS acceleration thresholds (m/s^2):
      if (rms <= 0.2) {
        severity = 0; // Normal (ambient noise / steady hand)
      } else if (rms <= 0.5) {
        severity = 1; // Mild tremor
      } else if (rms <= 1.5) {
        severity = 2; // Moderate tremor
      } else if (rms <= 3.0) {
        severity = 3; // Severe tremor
      } else {
        severity = 4; // Very severe tremor
      }
    } else {
      // Pen. Lighter object, held in fingers, more sensitive to fine motor tremors.
      // Thresholds are lower because fine finger tremors generate less absolute acceleration.
      if (rms <= 0.1) {
        severity = 0; // Normal
      } else if (rms <= 0.3) {
        severity = 1; // Mild tremor
      } else if (rms <= 0.8) {
        severity = 2; // Moderate tremor
      } else if (rms <= 2.0) {
        severity = 3; // Severe tremor
      } else {
        severity = 4; // Very severe tremor
      }
    }

    // Ensure severity is within 0-4 range
    return Math.max(0, Math.min(4, severity));
  }

  /**
   * Maps severity score to disease stage (Stage 1, 2, 3)
   */
  public getStage(severity: number): string {
    if (severity === 0) return 'Normal';
    if (severity <= 1.5) return 'Stage 1';
    if (severity <= 2.5) return 'Stage 2';
    if (severity <= 3.5) return 'Stage 3';
    return 'Stage 4';
  }
}

export const mlService = new TremorMLService();
