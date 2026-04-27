import { SensorData } from './serial';

export const BLE_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
export const BLE_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

class BLEService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private onDataCallback: ((data: SensorData) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  async connect() {
    if (!("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth API not supported in this browser.");
    }

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "NeuroTremor_Node_C3" }],
        optionalServices: [BLE_SERVICE_UUID]
      });

      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      this.server = await this.device.gatt!.connect();
      const service = await this.server.getPrimaryService(BLE_SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);

      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));
      
      return true;
    } catch (error) {
      console.error("BLE Connection failed", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
  }

  private onDisconnected() {
    if (this.onErrorCallback) {
      this.onErrorCallback("Device disconnected");
    }
  }

  private handleNotifications(event: Event) {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;

    const decoder = new TextDecoder('utf-8');
    const line = decoder.decode(value);
    this.parseLine(line);
  }

  private parseLine(line: string) {
    try {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Expected format: X:0.00,Y:0.00,Z:0.00,F:0
      if (trimmed.includes('X:') && trimmed.includes('Y:')) {
         const parts = trimmed.split(',');
         const data: any = {};
         parts.forEach(p => {
           const [key, val] = p.split(':');
           if (key && val) data[key.trim()] = Number(val);
         });
         
         if ('X' in data && 'Y' in data && 'Z' in data) {
           const sensorData: SensorData = {
             timestamp: Date.now(),
             ax: Number(data.X) || 0,
             ay: Number(data.Y) || 0,
             az: Number(data.Z) || 0,
             gx: Number(data.GX) || 0,
             gy: Number(data.GY) || 0,
             gz: Number(data.GZ) || 0,
             mx: Number(data.MX) || 0,
             my: Number(data.MY) || 0,
             mz: Number(data.MZ) || 0,
             fsr: Number(data.F) || 0,
             phase: 0,
             amplitude: 0
           };
           if (this.onDataCallback) this.onDataCallback(sensorData);
         }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  onData(callback: (data: SensorData) => void) {
    this.onDataCallback = callback;
  }

  onError(callback: (error: string) => void) {
    this.onErrorCallback = callback;
  }
}

export const bleService = new BLEService();
