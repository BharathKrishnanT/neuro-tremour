// ==========================================
// PIN CONFIGURATION & WIRING
// ==========================================
// 
// MMWave Sensor (HLK-LD2420)  <-->   ESP32 Board
// ------------------------          -------------------
// 3V3                        --->   3.3V (3V3)
// GND                        --->   GND
// OT1 (Presence Output)      --->   GPIO 18
// RX                         --->   (Not used for digital mode)
// OT2                        --->   GPIO 19
// ==========================================

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// BLE Characteristic UUIDs
#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Hardware Pins for MMWave Sensor Digital Outputs
#define MMWAVE_OT1_PIN 18
#define MMWAVE_OT2_PIN 19

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };
    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); //disable brownout detector
  
  Serial.begin(115200); // For USB debugging / direct UART connection

  // Initialize Digital Pins with PULLDOWN to prevent floating values
  pinMode(MMWAVE_OT1_PIN, INPUT_PULLDOWN);
  pinMode(MMWAVE_OT2_PIN, INPUT_PULLDOWN);

  Serial.println("Starting BLE NeuroTremor_Node_C3 + MMWave (OT1 & OT2)");

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
  // Send data at 10Hz (every 100ms)
  if (millis() - lastSendTime > 100) {
    lastSendTime = millis();
    
    // Read digital states
    int ot1_state = digitalRead(MMWAVE_OT1_PIN);
    int ot2_state = digitalRead(MMWAVE_OT2_PIN);
    
    // Map state to Phase (P) and Amplitude (A) for the app dashboard
    float phase = 0.0;
    int amp = 0;
    
    if (ot1_state == HIGH) {
       // OT1 Only (Presence detected)
       // We use an honest step mapping here. 100 = Presence, 0 = Empty.
       phase = 0.0;
       amp = 100;
    } else {
       // Nothing detected (LOW)
       phase = 0.0;
       amp = 0;
    }

    // Format the simulated UART string that the app expects for MMWave: "P:xxx,A:xxx"
    char buffer[32];
    snprintf(buffer, sizeof(buffer), "P:%.2f,A:%d\n", phase, amp);

    // Also print out the RAW pin state so you can debug the sensor 
    Serial.print("OT1: ");
    Serial.print(ot1_state);
    Serial.print(" | OT2: ");
    Serial.print(ot2_state);
    Serial.print(" -> ");

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
