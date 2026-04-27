from flask import Flask, jsonify
from flask_cors import CORS
import lgpio
import time

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Pin Definitions (BCM numbering)
OT1_MOVE = 4
OT2_STAY = 17

# Initialize GPIO
h = lgpio.gpiochip_open(0)
lgpio.gpio_claim_input(h, OT1_MOVE)
lgpio.gpio_claim_input(h, OT2_STAY)

@app.route('/')
def get_sensor_data():
    try:
        moving = lgpio.gpio_read(h, OT1_MOVE)
        static = lgpio.gpio_read(h, OT2_STAY)
        print(f"Reading: MOVE={moving}, STAY={static}", flush=True)
        
        return jsonify({
            "type": "gpio",
            "moving": bool(moving),
            "static": bool(static),
            "timestamp": int(time.time() * 1000)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("--- J.A.R.V.I.S. Web Bridge Online (HTTP Mode) ---")
    print("Starting server on http://0.0.0.0:8080 ...")
    app.run(host='0.0.0.0', port=8080)
