export interface SensorData {
  timestamp: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  mx: number;
  my: number;
  mz: number;
  fsr: number;
  phase: number;
  amplitude: number;
  gpioState?: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

class SerialService {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private decoder = new TextDecoderStream();
  private onDataCallback: ((data: SensorData) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private isReading = false;

  async connect(baudRate: number = 115200) {
    if (!("serial" in navigator)) {
      throw new Error("Web Serial API not supported in this browser.");
    }

    try {
      // @ts-ignore - Navigator serial type is polyfilled in types/web-serial.d.ts
      this.port = await navigator.serial.requestPort();
      await this.port!.open({ baudRate });
      
      const textDecoder = new TextDecoderStream();
      // @ts-ignore
      const readableStreamClosed = this.port!.readable!.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();
      
      this.isReading = true;
      this.readLoop();
      return true;
    } catch (error) {
      console.error("Connection failed", error);
      throw error;
    }
  }

  async disconnect() {
    this.isReading = false;
    if (this.reader) {
      await this.reader.cancel();
      // The reader lock is released by cancel() in most cases, but we can't explicitly release if we're in a loop?
      // Actually, we just set isReading to false, wait for loop to exit, then release.
    }
    if (this.port) {
      await this.port.close();
    }
    this.port = null;
    this.reader = null;
  }

  private async readLoop() {
    let buffer = "";
    
    while (this.isReading && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          
          // Process all complete lines
          for (let i = 0; i < lines.length - 1; i++) {
            this.parseLine(lines[i]);
          }
          
          // Keep the last partial line in buffer
          buffer = lines[lines.length - 1];
        }
      } catch (error) {
        console.error("Read error", error);
        if (this.onErrorCallback) this.onErrorCallback(String(error));
        break;
      }
    }
  }

  private parseLine(line: string) {
    try {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      let sensorData: SensorData | null = null;

      // Try JSON first
      if (trimmed.startsWith('{')) {
        try {
          const data = JSON.parse(trimmed);
          sensorData = {
            timestamp: Date.now(),
            ax: Number(data.ax) || 0,
            ay: Number(data.ay) || 0,
            az: Number(data.az) || 0,
            gx: Number(data.gx) || 0,
            gy: Number(data.gy) || 0,
            gz: Number(data.gz) || 0,
            mx: Number(data.mx) || 0,
            my: Number(data.my) || 0,
            mz: Number(data.mz) || 0,
            fsr: Number(data.fsr) || 0,
            phase: Number(data.phase) || 0,
            amplitude: Number(data.amplitude) || 0
          };
        } catch (e) {
          // JSON parse error, ignore
        }
      } 
      
      // Fallback for CSV: ax,ay,az,gx,gy,gz,mx,my,mz,fsr
      if (!sensorData && trimmed.includes(',')) {
        // Check for Key-Value pair format: X:0.00,Y:0.00,Z:0.00,F:0
        if (trimmed.includes('X:') && trimmed.includes('Y:')) {
           const parts = trimmed.split(',');
           const data: any = {};
           parts.forEach(p => {
             const [key, val] = p.split(':');
             if (key && val) data[key.trim()] = Number(val);
           });
           
           if ('X' in data && 'Y' in data && 'Z' in data) {
             sensorData = {
               timestamp: Date.now(),
               ax: Number(data.X) || 0,
               ay: Number(data.Y) || 0,
               az: Number(data.Z) || 0,
               gx: 0, 
               gy: 0,
               gz: 0,
               mx: 0,
               my: 0,
               mz: 0,
               fsr: Number(data.F) || 0,
               phase: 0,
               amplitude: 0
             };
           }
        } 
        
        // Check for MMwave format: P:xxx,A:xxx
        if (!sensorData && trimmed.includes('P:') && trimmed.includes('A:')) {
           const parts = trimmed.split(',');
           const data: any = {};
           parts.forEach(p => {
             const [key, val] = p.split(':');
             if (key && val) data[key.trim()] = Number(val);
           });
           
           if ('P' in data && 'A' in data) {
             sensorData = {
               timestamp: Date.now(),
               ax: 0, ay: 0, az: 0,
               gx: 0, gy: 0, gz: 0,
               mx: 0, my: 0, mz: 0,
               fsr: 0,
               phase: Number(data.P) || 0,
               amplitude: Number(data.A) || 0
             };
           }
        }

        // Standard CSV (10 values: ax,ay,az,gx,gy,gz,mx,my,mz,fsr)
        if (!sensorData) {
          const parts = trimmed.split(',');
          if (parts.length >= 10) {
             sensorData = {
              timestamp: Date.now(),
              ax: Number(parts[0]) || 0,
              ay: Number(parts[1]) || 0,
              az: Number(parts[2]) || 0,
              gx: Number(parts[3]) || 0,
              gy: Number(parts[4]) || 0,
              gz: Number(parts[5]) || 0,
              mx: Number(parts[6]) || 0,
              my: Number(parts[7]) || 0,
              mz: Number(parts[8]) || 0,
              fsr: Number(parts[9]) || 0,
              phase: Number(parts[10]) || 0,
              amplitude: Number(parts[11]) || 0
            };
          } else if (parts.length >= 7) {
            // Legacy 7-value support
            sensorData = {
              timestamp: Date.now(),
              ax: Number(parts[0]) || 0,
              ay: Number(parts[1]) || 0,
              az: Number(parts[2]) || 0,
              gx: Number(parts[3]) || 0,
              gy: Number(parts[4]) || 0,
              gz: Number(parts[5]) || 0,
              mx: 0,
              my: 0,
              mz: 0,
              fsr: Number(parts[6]) || 0,
              phase: 0,
              amplitude: 0
            };
          }
        }
      }

      if (sensorData && this.onDataCallback) {
        this.onDataCallback(sensorData);
      }
    } catch (e) {
      // Ignore parse errors for noise
    }
  }

  onData(callback: (data: SensorData) => void) {
    this.onDataCallback = callback;
  }

  onError(callback: (error: string) => void) {
    this.onErrorCallback = callback;
  }
}

export const serialService = new SerialService();
