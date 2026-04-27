import serial
import time

# Configure the serial port for Raspberry Pi 5 UART
# Usually /dev/ttyAMA0 or /dev/ttyS0 for hardware serial
SERIAL_PORT = "/dev/ttyAMA0"
BAUD_RATE = 115200

def main():
    print(f"Connecting to HLK-LD2420 on {SERIAL_PORT} at {BAUD_RATE} baud...")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print("Connected! Waiting for mmWave data...")
        
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                
                # Assuming the sensor outputs P:xxx,A:xxx natively 
                # or through a lightweight translation script running here.
                # Just prints the raw line if it matches our mmWave format:
                if line.startswith("P:") or "P:" in line:
                    print(line)
                    
    except serial.SerialException as e:
        print(f"Error opening serial port: {e}")
        print("Did you enable Serial in raspi-config and add your user to the dialout group?")
    except KeyboardInterrupt:
        print("Exiting...")
        if 'ser' in locals() and ser.is_open:
            ser.close()

if __name__ == "__main__":
    main()
