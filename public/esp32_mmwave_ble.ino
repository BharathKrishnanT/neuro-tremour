// ==========================================
// PIN CONFIGURATION & WIRING
// ==========================================
// 
// MMWave Sensor              <-->   ESP32 Board
// ------------------------          -------------------
// VCC (3.3V)                 --->   3.3V (3V3)
// GND                        --->   GND
// OUT / Move / OT1           --->   GPIO 18
// Presence / Stay / OT2      --->   GPIO 19
// 
// If your sensor only has a single digital "OUT" pin, 
// just connect it to GPIO 18 and ignore GPIO 19.
// ==========================================

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// BLE Characteristic UUIDs
#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Hardware Pins for MMWave Sensor Digital Outputs
#define MMWAVE_MOVE_PIN 18
#define MMWAVE_STAY_PIN 19

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };
    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

void setup() {
  Serial.begin(115200); // For USB debugging / direct UART connection

  // Initialize Digital Pins with PULLDOWN to prevent floating HIGH values
  pinMode(MMWAVE_MOVE_PIN, INPUT_PULLDOWN);
  pinMode(MMWAVE_STAY_PIN, INPUT_PULLDOWN); // If unused by your sensor, this will stay LOW

  Serial.println("Starting BLE NeuroTremor_Node_C3 + MMWave (Digital Pins)");

  // Create the BLE Device
  BLEDevice::init("NeuroTremor_Node_C3");

  // Create the BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create the BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create a BLE Characteristic
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_WRITE  |
                      BLECharacteristic::PROPERTY_NOTIFY |
                      BLECharacteristic::PROPERTY_INDICATE
                    );

  pCharacteristic->addDescriptor(new BLE2902());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
  BLEDevice::startAdvertising();
  Serial.println("Waiting a client connection to notify...");
}

unsigned long lastSendTime = 0;

void loop() {
  // Send data at 20Hz (every 50ms)
  if (millis() - lastSendTime > 50) {
    lastSendTime = millis();
    
    // Read digital states
    int moving = digitalRead(MMWAVE_MOVE_PIN);
    int static_presence = digitalRead(MMWAVE_STAY_PIN);
    
    // Map states to Phase (P) and Amplitude (A) for the app dashboard
    float phase = 0.0;
    int amp = 0;
    
    if (moving == HIGH && static_presence == LOW) {
       // Only moving: simulate analog mmWave data so it fluctuates on the graph instead of a flat line
       phase = sin(millis() / 500.0) * 0.5;
       amp = 60 + random(0, 40);
    } else if (static_presence == HIGH && moving == LOW) {
       // Only static presence
       phase = 0.5;
       amp = 30 + random(0, 10);
    } else if (moving == HIGH && static_presence == HIGH) {
       // Both
       phase = sin(millis() / 300.0) * 0.8;
       amp = 80 + random(0, 20);
    } else if (moving == LOW && static_presence == LOW) {
       // Nothing detected
       phase = 0.0;
       amp = 0;
    }

    // Format the simulated UART string that the app expects for MMWave: "P:xxx,A:xxx"
    char buffer[32];
    snprintf(buffer, sizeof(buffer), "P:%.2f,A:%d\n", phase, amp);

    // Send to physical UART (for web UART connection)
    Serial.print(buffer);

    // Send over BLE
    if (deviceConnected) {
      pCharacteristic->setValue(buffer);
      pCharacteristic->notify();
    }
  }

  // Handle BLE disconnects and reconnects
  if (!deviceConnected && oldDeviceConnected) {
      delay(500); // give the bluetooth stack the chance to get things ready
      pServer->startAdvertising(); // restart advertising
      Serial.println("start advertising");
      oldDeviceConnected = deviceConnected;
  }
  
  if (deviceConnected && !oldDeviceConnected) {
      // do stuff here on connecting
      oldDeviceConnected = deviceConnected;
  }
}
