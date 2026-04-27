import asyncio
import websockets
import json
import lgpio
import time

# Pin Definitions (BCM numbering)
OT1_MOVE = 4
OT2_STAY = 17

async def sensor_server(websocket):
    print("Browser Dashboard Connected via WebSocket!")
    h = lgpio.gpiochip_open(0)
    lgpio.gpio_claim_input(h, OT1_MOVE)
    lgpio.gpio_claim_input(h, OT2_STAY)
    
    try:
        while True:
            moving = lgpio.gpio_read(h, OT1_MOVE)
            static = lgpio.gpio_read(h, OT2_STAY)
            
            # Send mapped JSON to the web app
            data = {
                "type": "gpio",
                "moving": bool(moving),
                "static": bool(static),
                "timestamp": int(time.time() * 1000)
            }
            await websocket.send(json.dumps(data))
            await asyncio.sleep(0.05) # 20Hz update rate
            
    except websockets.exceptions.ConnectionClosed:
        print("Browser disconnected.")
    finally:
        lgpio.gpiochip_close(h)

async def main():
    print("--- J.A.R.V.I.S. Web Bridge Online ---")
    print("Starting WebSocket server on ws://localhost:8080 ...")
    print("Keep this script running while using the web dashboard.")
    async with websockets.serve(sensor_server, "localhost", 8080):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
