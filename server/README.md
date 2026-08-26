# Whisper Slate — Local Sync Server

This FastAPI server acts as the local classroom synchronization layer between the student apps (capturing audio & computing embeddings locally) and the teacher dashboard (clustering and visualization).

## ⚠️ Security Guarantee
Per the project specification, **no audio is ever sent to this server**. The client only sends the text transcript and the 384-dimensional semantic embedding vector. Furthermore, no identifying information is logged here.

## Running the Server

Because this is designed to operate on a local, classroom-only network without WAN exposure, **you must bind the server to your local LAN IP address** rather than globally exposing it.

1. Find your local IP address (e.g. `192.168.1.5` or `10.0.0.X`).
2. Run the server using `uvicorn`:

```bash
pip install -r requirements.txt
uvicorn main:app --host <YOUR_LAN_IP> --port 8000
```

*Do not use `--host 0.0.0.0` if this machine is connected to a public or wider campus network.*
